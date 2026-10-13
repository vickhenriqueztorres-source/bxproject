/**
 * Sound Engine para Trading Terminal (Web Audio API)
 * Síntese em tempo real de latência zero sem assets externos pesados.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Som de click tátil da UI (stepper, botões, presets, tabs)
   */
  public playClick(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Ignora se o contexto estiver bloqueado pelo browser
    }
  }

  /**
   * Som de abertura de ordem (swoosh de disparo instantâneo)
   */
  public playOrderOpen(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(960, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Silencioso se bloqueado
    }
  }

  /**
   * Som comemorativo de vitória (WIN Chime / Arpeggio Cristalino Dopaminérgico)
   * Harmônicos puros de quartzo com shimmer de alta frequência para feedback satisfatório.
   */
  public playWin(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Arpeggio ascendente dopaminérgico: C5, G5, C6, E6 + Shimmer E7
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.40, vol: 0.09 },
        { freq: 783.99, time: 0.06, dur: 0.40, vol: 0.09 },
        { freq: 1046.50, time: 0.12, dur: 0.48, vol: 0.11 },
        { freq: 1318.51, time: 0.18, dur: 0.55, vol: 0.12 },
        { freq: 2637.02, time: 0.22, dur: 0.25, vol: 0.04 }, // Shimmer cristalino
      ];
      const start = ctx.currentTime;

      notes.forEach(({ freq, time, dur, vol }) => {
        const noteStart = start + time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(vol, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + dur);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
    } catch {
      // Silencioso se bloqueado
    }
  }

  /**
   * Som de precisão e encerramento sem lucro (LOSS)
   * Pulso acústico suave amortecido sem estrondos ou atrito frustrante.
   */
  public playLoss(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.14);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Silencioso se bloqueado
    }
  }

  /**
   * Som de empate (DRAW)
   */
  public playDraw(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // Silencioso se bloqueado
    }
  }
}

export const soundEngine = new SoundEngine();
