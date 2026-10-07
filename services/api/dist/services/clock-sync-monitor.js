"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalClockMonitor = exports.ClockSyncMonitor = exports.MAX_CLOCK_OFFSET_CRITICAL_MS = exports.MAX_CLOCK_OFFSET_WARNING_MS = void 0;
exports.MAX_CLOCK_OFFSET_WARNING_MS = 100;
exports.MAX_CLOCK_OFFSET_CRITICAL_MS = 500;
class ClockSyncMonitor {
    warningThresholdMs;
    criticalThresholdMs;
    offsetMs = 0;
    rttMs = 0;
    alert = false;
    severity = 'OK';
    lastChecked = 0;
    constructor(warningThresholdMs = exports.MAX_CLOCK_OFFSET_WARNING_MS, criticalThresholdMs = exports.MAX_CLOCK_OFFSET_CRITICAL_MS) {
        this.warningThresholdMs = warningThresholdMs;
        this.criticalThresholdMs = criticalThresholdMs;
    }
    /**
     * Registra uma amostra de medição contra uma fonte de tempo de referência (NTP ou PostgreSQL clock_timestamp).
     * @param tStartMonotonic Tempo local de início da requisição (ms)
     * @param tReference Tempo retornado pela fonte de referência (epoch ms)
     * @param tEndMonotonic Tempo local de fim da requisição (ms)
     */
    recordSample(tStartMonotonic, tReference, tEndMonotonic) {
        const rtt = Math.max(0, tEndMonotonic - tStartMonotonic);
        const estimatedMidpoint = tStartMonotonic + rtt / 2;
        const offset = Math.round(tReference - estimatedMidpoint);
        this.rttMs = rtt;
        this.offsetMs = offset;
        this.lastChecked = Date.now();
        const absOffset = Math.abs(offset);
        if (absOffset > this.criticalThresholdMs) {
            this.severity = 'CRITICAL';
            this.alert = true;
            console.error(JSON.stringify({
                event: 'CLOCK_SKEW_CRITICAL',
                offset_ms: offset,
                rtt_ms: rtt,
                threshold_ms: this.criticalThresholdMs,
                timestamp: new Date().toISOString()
            }));
        }
        else if (absOffset > this.warningThresholdMs) {
            this.severity = 'WARNING';
            this.alert = true;
            console.warn(JSON.stringify({
                event: 'CLOCK_SKEW_WARNING',
                offset_ms: offset,
                rtt_ms: rtt,
                threshold_ms: this.warningThresholdMs,
                timestamp: new Date().toISOString()
            }));
        }
        else {
            this.severity = 'OK';
            this.alert = false;
        }
        return this.getStatus();
    }
    getStatus() {
        return {
            offsetMs: this.offsetMs,
            rttMs: this.rttMs,
            calibrated: this.lastChecked > 0,
            alert: this.alert,
            severity: this.severity,
            timestamp: new Date().toISOString(),
        };
    }
    getOffsetMs() {
        return this.offsetMs;
    }
    isAlertActive() {
        return this.alert;
    }
}
exports.ClockSyncMonitor = ClockSyncMonitor;
exports.globalClockMonitor = new ClockSyncMonitor();
