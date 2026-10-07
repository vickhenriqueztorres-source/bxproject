/**
 * Backpressure Guard para WebSocket Gateway (Padrão de Resiliência contra Clientes Lentos)
 */

export interface BackpressureConfig {
  maxBufferedBytes?: number;     // Padrão: 64KB (65536 bytes)
  slowClientTimeoutMs?: number;  // Padrão: 5000ms (5 segundos)
}

export type SocketLike = {
  bufferedAmount: number;
  readyState: number;
  close(code?: number, reason?: string): void;
  on?(event: string, listener: (...args: any[]) => void): void;
};

export class BackpressureGuard {
  private readonly maxBufferedBytes: number;
  private readonly slowClientTimeoutMs: number;
  private saturatedSockets = new Map<SocketLike, number>();
  private pausedCount = 0;
  private disconnectedCount = 0;

  constructor(
    config: BackpressureConfig = {},
    private readonly timeFn: () => number = Date.now
  ) {
    this.maxBufferedBytes = config.maxBufferedBytes ?? 64 * 1024;
    this.slowClientTimeoutMs = config.slowClientTimeoutMs ?? 5000;
  }

  public shouldSend(socket: SocketLike): boolean {
    if (socket.readyState !== 1) return false;

    if (socket.bufferedAmount > this.maxBufferedBytes) {
      const now = this.timeFn();
      if (!this.saturatedSockets.has(socket)) {
        this.saturatedSockets.set(socket, now);
        this.pausedCount++;
      } else {
        const saturatedDuration = now - (this.saturatedSockets.get(socket) ?? now);
        if (saturatedDuration >= this.slowClientTimeoutMs) {
          this.disconnectSlowClient(socket);
          return false;
        }
      }
      return false;
    }

    if (this.saturatedSockets.has(socket)) {
      this.saturatedSockets.delete(socket);
      if (this.pausedCount > 0) this.pausedCount--;
    }

    return true;
  }

  public handleDrain(socket: SocketLike): void {
    if (this.saturatedSockets.has(socket)) {
      this.saturatedSockets.delete(socket);
      if (this.pausedCount > 0) this.pausedCount--;
    }
  }

  public checkAndPurgeSlowClients(): number {
    const now = this.timeFn();
    let purged = 0;
    for (const [socket, startTime] of this.saturatedSockets.entries()) {
      if (now - startTime >= this.slowClientTimeoutMs) {
        this.disconnectSlowClient(socket);
        purged++;
      }
    }
    return purged;
  }

  private disconnectSlowClient(socket: SocketLike): void {
    this.saturatedSockets.delete(socket);
    if (this.pausedCount > 0) this.pausedCount--;
    this.disconnectedCount++;
    try {
      socket.close(4429, 'Slow client backpressure timeout');
    } catch {
      // Ignora erro ao fechar
    }
  }

  public getPausedCount(): number {
    return this.pausedCount;
  }

  public getDisconnectedCount(): number {
    return this.disconnectedCount;
  }

  public getMaxBufferedBytes(): number {
    return this.maxBufferedBytes;
  }
}
