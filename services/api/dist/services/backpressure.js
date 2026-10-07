"use strict";
/**
 * Backpressure Guard para WebSocket Gateway (Padrão de Resiliência contra Clientes Lentos)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackpressureGuard = void 0;
class BackpressureGuard {
    timeFn;
    maxBufferedBytes;
    slowClientTimeoutMs;
    saturatedSockets = new Map();
    pausedCount = 0;
    disconnectedCount = 0;
    constructor(config = {}, timeFn = Date.now) {
        this.timeFn = timeFn;
        this.maxBufferedBytes = config.maxBufferedBytes ?? 64 * 1024;
        this.slowClientTimeoutMs = config.slowClientTimeoutMs ?? 5000;
    }
    shouldSend(socket) {
        if (socket.readyState !== 1)
            return false;
        if (socket.bufferedAmount > this.maxBufferedBytes) {
            const now = this.timeFn();
            if (!this.saturatedSockets.has(socket)) {
                this.saturatedSockets.set(socket, now);
                this.pausedCount++;
            }
            else {
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
            if (this.pausedCount > 0)
                this.pausedCount--;
        }
        return true;
    }
    handleDrain(socket) {
        if (this.saturatedSockets.has(socket)) {
            this.saturatedSockets.delete(socket);
            if (this.pausedCount > 0)
                this.pausedCount--;
        }
    }
    checkAndPurgeSlowClients() {
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
    disconnectSlowClient(socket) {
        this.saturatedSockets.delete(socket);
        if (this.pausedCount > 0)
            this.pausedCount--;
        this.disconnectedCount++;
        try {
            socket.close(4429, 'Slow client backpressure timeout');
        }
        catch {
            // Ignora erro ao fechar
        }
    }
    getPausedCount() {
        return this.pausedCount;
    }
    getDisconnectedCount() {
        return this.disconnectedCount;
    }
    getMaxBufferedBytes() {
        return this.maxBufferedBytes;
    }
}
exports.BackpressureGuard = BackpressureGuard;
