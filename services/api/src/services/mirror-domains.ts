import { MirrorDomainDTO, MirrorDomainStatus } from "@broker/shared";

export interface RotateDomainResult {
  previousDomain: string;
  currentDomain: string;
  targetCountry: string | null;
  rotatedAt: string;
}

export class MirrorDomainService {
  constructor(
    private pg: any,
    private redis?: any
  ) {}

  /**
   * Lista todos os domínios espelhos cadastrados, opcionalmente filtrados por país
   */
  async listMirrors(targetCountry?: string): Promise<MirrorDomainDTO[]> {
    let query = `
      SELECT id, domain_name, target_country, status, priority, latency_ms, last_health_check_at 
      FROM mirror_domains
    `;
    const params: any[] = [];

    if (targetCountry) {
      query += ` WHERE target_country = $1 OR target_country IS NULL`;
      params.push(targetCountry.toUpperCase());
    }

    query += ` ORDER BY priority ASC, updated_at DESC`;

    const res = await this.pg.query(query, params);
    return res.rows.map((row: any) => ({
      id: row.id,
      domain_name: row.domain_name,
      target_country: row.target_country,
      status: row.status as MirrorDomainStatus,
      priority: row.priority,
      latency_ms: row.latency_ms,
      last_health_check_at: row.last_health_check_at?.toISOString?.() || row.last_health_check_at
    }));
  }

  /**
   * Obtém o domínio espelho atualmente ativo para um país (ou global)
   */
  async getActiveMirror(targetCountry?: string): Promise<MirrorDomainDTO | null> {
    const country = targetCountry ? targetCountry.toUpperCase() : null;

    // 1. Tentar busca específica para o país
    if (country) {
      const specificRes = await this.pg.query(
        `SELECT id, domain_name, target_country, status, priority, latency_ms, last_health_check_at 
         FROM mirror_domains 
         WHERE target_country = $1 AND status = 'ACTIVE' 
         ORDER BY priority ASC LIMIT 1`,
        [country]
      );
      if (specificRes.rows.length > 0) {
        const row = specificRes.rows[0];
        return {
          id: row.id,
          domain_name: row.domain_name,
          target_country: row.target_country,
          status: row.status,
          priority: row.priority,
          latency_ms: row.latency_ms,
          last_health_check_at: row.last_health_check_at?.toISOString?.() || row.last_health_check_at
        };
      }
    }

    // 2. Fallback para espelho global ativo
    const globalRes = await this.pg.query(
      `SELECT id, domain_name, target_country, status, priority, latency_ms, last_health_check_at 
       FROM mirror_domains 
       WHERE target_country IS NULL AND status = 'ACTIVE' 
       ORDER BY priority ASC LIMIT 1`
    );
    if (globalRes.rows.length > 0) {
      const row = globalRes.rows[0];
      return {
        id: row.id,
        domain_name: row.domain_name,
        target_country: row.target_country,
        status: row.status,
        priority: row.priority,
        latency_ms: row.latency_ms,
        last_health_check_at: row.last_health_check_at?.toISOString?.() || row.last_health_check_at
      };
    }

    return null;
  }

  /**
   * Executa rotação atômica de domínio após bloqueio DNS (ex: ordem judicial / Anatel)
   */
  async rotateDomain(blockedDomain: string, targetCountry?: string): Promise<RotateDomainResult> {
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");

      // 1. Marcar o domínio bloqueado como BLOCKED
      const updateBlocked = await client.query(
        `UPDATE mirror_domains 
         SET status = 'BLOCKED', updated_at = NOW() 
         WHERE domain_name = $1 
         RETURNING target_country`,
        [blockedDomain]
      );

      const country = targetCountry || (updateBlocked.rows[0]?.target_country ?? null);

      // 2. Selecionar o próximo domínio em STANDBY para o mesmo target_country
      let nextCandidateQuery = `
        SELECT id, domain_name 
        FROM mirror_domains 
        WHERE status = 'STANDBY' 
      `;
      const queryParams: any[] = [];

      if (country) {
        nextCandidateQuery += ` AND (target_country = $1 OR target_country IS NULL)`;
        queryParams.push(country);
      } else {
        nextCandidateQuery += ` AND target_country IS NULL`;
      }

      nextCandidateQuery += ` ORDER BY priority ASC LIMIT 1 FOR UPDATE`;

      const nextRes = await client.query(nextCandidateQuery, queryParams);

      if (nextRes.rows.length === 0) {
        throw new Error(`Nenhum domínio espelho STANDBY disponível para substituição de ${blockedDomain}`);
      }

      const nextDomain = nextRes.rows[0].domain_name;

      // 3. Promover o candidato a ACTIVE
      await client.query(
        `UPDATE mirror_domains 
         SET status = 'ACTIVE', updated_at = NOW() 
         WHERE domain_name = $1`,
        [nextDomain]
      );

      await client.query("COMMIT");

      // 4. Invalidação e Atualização no Redis
      if (this.redis) {
        try {
          if (country) {
            await this.redis.set(`reg:mirror:${country}`, nextDomain, "EX", 300);
          }
          await this.redis.del(`reg:mirror:GLOBAL`);

          // Notificar via Pub/Sub para outros nós de API e Gateways
          await this.redis.publish("system:domain_rotated", JSON.stringify({
            event: "DOMAIN_ROTATED",
            previousDomain: blockedDomain,
            currentDomain: nextDomain,
            targetCountry: country,
            rotatedAt: new Date().toISOString()
          }));
        } catch {
          // Ignora falha de cache / pubsub se Redis indisponível
        }
      }

      return {
        previousDomain: blockedDomain,
        currentDomain: nextDomain,
        targetCountry: country,
        rotatedAt: new Date().toISOString()
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Registra resultado de health-check e latência do domínio espelho
   */
  async registerHealthCheck(domainName: string, latencyMs: number, status?: MirrorDomainStatus): Promise<void> {
    let query = `
      UPDATE mirror_domains 
      SET latency_ms = $1, last_health_check_at = NOW(), updated_at = NOW()
    `;
    const params: any[] = [latencyMs, domainName];

    if (status) {
      query = `
        UPDATE mirror_domains 
        SET latency_ms = $1, status = $3, last_health_check_at = NOW(), updated_at = NOW()
        WHERE domain_name = $2
      `;
      params.push(status);
    } else {
      query += ` WHERE domain_name = $2`;
    }

    await this.pg.query(query, params);
  }

  /**
   * Cadastra novo domínio espelho na infraestrutura
   */
  async addMirror(data: {
    domain_name: string;
    target_country?: string | null;
    priority: number;
    status?: MirrorDomainStatus;
  }): Promise<MirrorDomainDTO> {
    const res = await this.pg.query(
      `INSERT INTO mirror_domains (domain_name, target_country, priority, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, domain_name, target_country, status, priority, latency_ms, last_health_check_at`,
      [
        data.domain_name,
        data.target_country || null,
        data.priority,
        data.status || "STANDBY"
      ]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      domain_name: row.domain_name,
      target_country: row.target_country,
      status: row.status,
      priority: row.priority,
      latency_ms: row.latency_ms,
      last_health_check_at: row.last_health_check_at?.toISOString?.() || row.last_health_check_at
    };
  }
}
