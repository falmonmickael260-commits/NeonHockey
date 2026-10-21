/**
 * All sound effects are synthesized at runtime with the Web Audio API —
 * no binary asset files to ship or license. Must be unlocked by a user
 * gesture (browser autoplay policy), hence the explicit `unlock()`.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.7;
  private droneNodes: { osc: OscillatorNode; gain: GainNode } | null = null;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master && !this.muted) this.master.gain.value = volume;
  }

  private tone(freq: number, duration: number, type: OscillatorType, peak: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Puck struck by a mallet — sharper and louder the harder the hit. */
  playHit(intensity: number): void {
    const clamped = Math.min(1, Math.max(0, intensity));
    this.tone(260 + clamped * 420, 0.09, 'square', 0.18 + clamped * 0.22);
    this.tone(1400 + clamped * 600, 0.05, 'triangle', 0.08 + clamped * 0.1);
  }

  playWallBounce(): void {
    this.tone(180, 0.08, 'sine', 0.12);
  }

  playGoal(): void {
    [0, 0.09, 0.18].forEach((d, i) => this.tone(520 + i * 220, 0.3, 'sawtooth', 0.22, d));
  }

  playCountdownBeep(final: boolean): void {
    this.tone(final ? 880 : 520, final ? 0.35 : 0.12, 'square', final ? 0.3 : 0.18);
  }

  playUiHover(): void {
    this.tone(700, 0.04, 'sine', 0.06);
  }

  playUiClick(): void {
    this.tone(900, 0.07, 'triangle', 0.12);
    this.tone(450, 0.09, 'sine', 0.08, 0.02);
  }

  /** Subtle looping electronic ambience for menus — started/stopped explicitly
   * so it never fights with the autoplay policy. */
  startAmbience(): void {
    if (!this.ctx || !this.master || this.droneNodes) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    gain.gain.value = 0.035;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.droneNodes = { osc, gain };
  }

  stopAmbience(): void {
    if (!this.droneNodes) return;
    this.droneNodes.osc.stop();
    this.droneNodes = null;
  }
}

export const audioEngine = new AudioEngine();
