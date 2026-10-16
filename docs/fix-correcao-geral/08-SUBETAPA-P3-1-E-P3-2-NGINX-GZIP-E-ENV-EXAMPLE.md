# Subetapa 08 (P3-1 & P3-2) — Nginx `gzip on;` e Documentação Completa do `.env.example`

**Itens:** `P3-1` e `P3-2` (Limpeza, Performance HTTP e Governança de Configuração)  
**Agentes:** `backend-implementation-agent` (Implementação) | `security-reviewer` + `regression-guardian-agent` (Revisão e Verificação)  
**Skills:** `04-security-iam`, `07-production-operations`, `17-mudanca-cirurgica`

---

## 1. Item P3-1 — Nginx `gzip on;` e Cache Imutável

### 1.1 Diagnóstico
- O teste `tests/subetapa-4-candles-performance-build.test.mjs:136` verifica `scripts/update-nginx-ssl.mjs` esperando:
  1. `gzip on;`
  2. `gzip_static on;`
  3. `public, max-age=31536000, immutable` para `/assets/`
- Atualmente, `scripts/update-nginx-ssl.mjs` não inclui as diretivas de compressão gzip nem o bloco `location /assets/`, fazendo o teste `Subetapa 4.4` falhar!

### 1.2 Correção em `scripts/update-nginx-ssl.mjs`
Habilitar no bloco `server` de `scripts/update-nginx-ssl.mjs` (e remover qualquer credencial hardcoded de SSH em favor de variáveis de ambiente `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_PASSWORD`):
```nginx
    # Compressão Gzip e Gzip Estático para JSON/JS/CSS/SVG (Subetapa 4.4 / P3-1)
    gzip on;
    gzip_static on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Cache imutável de 1 ano para bundles versionados por hash do Vite
    location /assets/ {
        root /root/app/apps/web/dist;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
```

---

## 2. Item P3-2 — `.env.example` Completo Gerado por Grep

### 2.1 Diagnóstico
- Várias flags e variáveis lidas por `process.env.*` em `scripts/` e `services/` não estavam documentadas no `.env.example`.
- Regra do prompt: "documentar TODAS as variáveis lidas por `process.env` em `scripts/` e `services/` (incluindo as `FEATURE_*` novas e `BLNK_ENABLED` do P0-1), com valor padrão e efeito. Gerar a lista por grep, não de memória."

### 2.2 Passo a Passo
1. Executar grep automatizado sobre `scripts/**/*.{mjs,js,ts}` e `services/**/*.{mjs,js,ts}` extraindo todas as ocorrências de `process.env.<VAR>`.
2. Atualizar `.env.example` documentando 100% das variáveis encontradas, agrupadas por subsistema, indicando o **valor padrão** e o **efeito operacional** de cada uma (sem nenhum segredo real).
3. Criar teste automatizado `tests/unit/p3-env-example-completeness.test.mjs` que faz o grep dinâmico de `process.env.([A-Z0-9_]+)` em `scripts/` e `services/` (excluindo variáveis internas do Node/SO como `NODE_ENV`, `PATH`, `PWD`, `HOME`, `CI` se já listadas) e comprova que **todas** estão documentadas no `.env.example`!
