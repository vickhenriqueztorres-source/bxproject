export interface MirrorCandidate {
  domain: string;
  country?: string | null;
  priority: number;
}

export class MirrorFailoverManager {
  private static instance: MirrorFailoverManager;
  private currentDomain: string;
  private availableMirrors: MirrorCandidate[] = [];
  private country: string = "BR";
  private onDomainRotatedListeners: ((newDomain: string) => void)[] = [];

  constructor(initialDomain: string = window?.location?.hostname || "localhost") {
    this.currentDomain = initialDomain;
    this.loadCachedMirrors();
  }

  static getInstance(): MirrorFailoverManager {
    if (!MirrorFailoverManager.instance) {
      MirrorFailoverManager.instance = new MirrorFailoverManager();
    }
    return MirrorFailoverManager.instance;
  }

  setCountry(country: string) {
    this.country = country.toUpperCase();
    this.loadCachedMirrors();
  }

  getCurrentDomain(): string {
    return this.currentDomain;
  }

  getCurrentApiBaseUrl(): string {
    const proto = window?.location?.protocol || "http:";
    const port = window?.location?.port ? `:${window.location.port}` : "";
    if (this.currentDomain === "localhost" || this.currentDomain === "127.0.0.1") {
      return `${proto}//${this.currentDomain}${port}`;
    }
    return `${proto}//${this.currentDomain}`;
  }

  getCurrentWsUrl(): string {
    const proto = window?.location?.protocol === "https:" ? "wss:" : "ws:";
    const port = this.currentDomain === "localhost" ? ":3001" : "";
    return `${proto}//${this.currentDomain}${port}/ws`;
  }

  updateMirrorsList(mirrors: MirrorCandidate[]) {
    this.availableMirrors = mirrors.sort((a, b) => a.priority - b.priority);
    try {
      localStorage.setItem(`broker:mirrors:${this.country}`, JSON.stringify(this.availableMirrors));
    } catch {
      // Ignora erro de quota local storage
    }
  }

  private loadCachedMirrors() {
    try {
      const cached = localStorage.getItem(`broker:mirrors:${this.country}`);
      if (cached) {
        this.availableMirrors = JSON.parse(cached);
      }
    } catch {
      this.availableMirrors = [];
    }

    if (this.availableMirrors.length === 0) {
      // Defaults de fallback resiliente
      this.availableMirrors = [
        { domain: this.currentDomain, priority: 10 },
        { domain: this.country === "BR" ? "app.nomedominio-br1.com" : "app.nomedominio-global.com", priority: 20 },
        { domain: this.country === "BR" ? "app.nomedominio-br2.com" : "app.nomedominio-global2.com", priority: 30 }
      ];
    }
  }

  /**
   * Dispara rotação de domínio cliente quando uma chamada de rede falhar por bloqueio de DNS
   */
  rotateToNextMirror(): string {
    const currentIndex = this.availableMirrors.findIndex(m => m.domain === this.currentDomain);
    const nextIndex = (currentIndex + 1) % this.availableMirrors.length;
    const nextMirror = this.availableMirrors[nextIndex].domain;

    console.warn(`[Failover] Rotação de domínio espelho ativada: ${this.currentDomain} -> ${nextMirror}`);
    this.currentDomain = nextMirror;

    // Notificar listeners (como WebSocket client para reconexão transparente)
    for (const listener of this.onDomainRotatedListeners) {
      listener(nextMirror);
    }

    return nextMirror;
  }

  onDomainRotated(callback: (newDomain: string) => void) {
    this.onDomainRotatedListeners.push(callback);
  }

  /**
   * Wrapper resiliente para fetch que tenta o espelho reserva em caso de falha de conexão
   */
  async resilientFetch(input: string, init?: RequestInit): Promise<Response> {
    const maxRetries = this.availableMirrors.length;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const baseUrl = this.getCurrentApiBaseUrl();
        const fullUrl = input.startsWith("http") ? input : `${baseUrl}${input.startsWith("/") ? "" : "/"}${input}`;
        const res = await fetch(fullUrl, init);
        return res;
      } catch (err) {
        attempts++;
        console.warn(`[Failover] Falha de conexão ao espelho ${this.currentDomain}. Tentativa ${attempts} de ${maxRetries}.`);
        if (attempts < maxRetries) {
          this.rotateToNextMirror();
        } else {
          throw err;
        }
      }
    }

    throw new Error("Todos os domínios espelho estão inacessíveis no momento.");
  }
}
