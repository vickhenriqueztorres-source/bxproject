export interface ClockSyncStatus {
  offsetMs: number;
  rttMs: number;
  calibrated: boolean;
  alert: boolean;
  severity: 'OK' | 'WARNING' | 'CRITICAL';
  timestamp: string;
}

export const MAX_CLOCK_OFFSET_WARNING_MS = 100;
export const MAX_CLOCK_OFFSET_CRITICAL_MS = 500;

export class ClockSyncMonitor {
  private offsetMs = 0;
  private rttMs = 0;
  private alert = false;
  private severity: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
  private lastChecked = 0;

  constructor(
    private warningThresholdMs = MAX_CLOCK_OFFSET_WARNING_MS,
    private criticalThresholdMs = MAX_CLOCK_OFFSET_CRITICAL_MS
  ) {}

  /**
   * Registra uma amostra de medição contra uma fonte de tempo de referência (NTP ou PostgreSQL clock_timestamp).
   * @param tStartMonotonic Tempo local de início da requisição (ms)
   * @param tReference Tempo retornado pela fonte de referência (epoch ms)
   * @param tEndMonotonic Tempo local de fim da requisição (ms)
   */
  public recordSample(tStartMonotonic: number, tReference: number, tEndMonotonic: number): ClockSyncStatus {
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
    } else if (absOffset > this.warningThresholdMs) {
      this.severity = 'WARNING';
      this.alert = true;
      console.warn(JSON.stringify({
        event: 'CLOCK_SKEW_WARNING',
        offset_ms: offset,
        rtt_ms: rtt,
        threshold_ms: this.warningThresholdMs,
        timestamp: new Date().toISOString()
      }));
    } else {
      this.severity = 'OK';
      this.alert = false;
    }

    return this.getStatus();
  }

  public getStatus(): ClockSyncStatus {
    return {
      offsetMs: this.offsetMs,
      rttMs: this.rttMs,
      calibrated: this.lastChecked > 0,
      alert: this.alert,
      severity: this.severity,
      timestamp: new Date().toISOString(),
    };
  }

  public getOffsetMs(): number {
    return this.offsetMs;
  }

  public isAlertActive(): boolean {
    return this.alert;
  }
}

export const globalClockMonitor = new ClockSyncMonitor();
