import {
  GOAL_HALF_WIDTH,
  MALLET_RADIUS,
  PUCK_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type Team,
} from '@neon-hockey/shared';
import type { ArenaTheme } from './arenas';

interface MalletRenderInfo {
  x: number;
  y: number;
  team: Team;
  isMine: boolean;
}

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface RenderFrame {
  puck: { x: number; y: number };
  mallets: MalletRenderInfo[];
  theme: ArenaTheme;
  reduceEffects: boolean;
}

const CENTER_X = TABLE_WIDTH / 2;
const CENTER_Y = TABLE_HEIGHT / 2;

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private trail: TrailPoint[] = [];
  private particles: Particle[] = [];
  private shake = 0;
  private flashIntensity = 0;
  private flashColor = '#ffffff';
  private time = 0;
  private stars: { x: number; y: number; r: number; tw: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.seedStars();
  }

  private seedStars(): void {
    const rng = mulberry32(1337);
    for (let i = 0; i < 70; i++) {
      this.stars.push({ x: rng(), y: rng(), r: 0.6 + rng() * 1.6, tw: rng() * Math.PI * 2 });
    }
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    // A transiently collapsed container (layout not settled yet, tab hidden,
    // etc.) must never zero out the scale — that would turn every future
    // screen→table conversion into NaN until the next real resize.
    if (cssWidth <= 0 || cssHeight <= 0) return;

    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tableAspect = TABLE_WIDTH / TABLE_HEIGHT;
    const viewAspect = cssWidth / cssHeight;
    if (viewAspect > tableAspect) {
      this.scale = cssHeight / TABLE_HEIGHT;
    } else {
      this.scale = cssWidth / TABLE_WIDTH;
    }
    this.offsetX = (cssWidth - TABLE_WIDTH * this.scale) / 2;
    this.offsetY = (cssHeight - TABLE_HEIGHT * this.scale) / 2;
  }

  /** Converts a pointer/touch event's CSS-pixel coordinates into table space. */
  screenToTable(cssX: number, cssY: number): { x: number; y: number } {
    return {
      x: (cssX - this.offsetX) / this.scale,
      y: (cssY - this.offsetY) / this.scale,
    };
  }

  notifyGoal(team: Team): void {
    this.flashIntensity = 1;
    this.flashColor = team === 'cyan' ? '#39e6ff' : '#ff3fd1';
    this.shake = 14;
  }

  spawnHitSpark(x: number, y: number, color: string, power: number): void {
    const count = 6 + Math.round(power * 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180 * (0.4 + power);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.2,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  private stepEffects(dt: number): void {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 28);
    if (this.flashIntensity > 0) this.flashIntensity = Math.max(0, this.flashIntensity - dt * 1.6);

    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
  }

  private pushTrail(x: number, y: number): void {
    this.trail.unshift({ x, y, alpha: 1 });
    if (this.trail.length > 16) this.trail.pop();
    for (const t of this.trail) t.alpha *= 0.88;
  }

  render(frame: RenderFrame, dt: number): void {
    this.stepEffects(dt);
    this.pushTrail(frame.puck.x, frame.puck.y);

    const { ctx } = this;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Letterbox background (outside the table) + a soft dark base.
    ctx.fillStyle = '#020108';
    ctx.fillRect(0, 0, w, h);

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;

    ctx.translate(this.offsetX + shakeX, this.offsetY + shakeY);
    ctx.scale(this.scale, this.scale);

    this.drawTableSurface(frame);
    if (!frame.reduceEffects) this.drawAmbientStars(frame);
    this.drawRails(frame);
    this.drawGoals(frame);
    this.drawCenterLine(frame);

    if (!frame.reduceEffects) this.drawTrail(frame);
    this.drawMallets(frame);
    this.drawPuck(frame);
    if (!frame.reduceEffects) this.drawParticles();

    ctx.restore();

    if (this.flashIntensity > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashIntensity * 0.35;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  private drawTableSurface(frame: RenderFrame): void {
    const { ctx, } = this;
    const grad = ctx.createRadialGradient(
      CENTER_X,
      CENTER_Y,
      40,
      CENTER_X,
      CENTER_Y,
      Math.max(TABLE_WIDTH, TABLE_HEIGHT) * 0.75,
    );
    grad.addColorStop(0, frame.theme.bgInner);
    grad.addColorStop(1, frame.theme.bgOuter);
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, TABLE_WIDTH, TABLE_HEIGHT, 26);
    ctx.fill();

    // Subtle grid texture — discreet, never competes with puck/mallet visibility.
    ctx.save();
    ctx.strokeStyle = frame.theme.surfaceGrid;
    ctx.lineWidth = 1;
    const step = 58;
    for (let x = step; x < TABLE_WIDTH; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, TABLE_HEIGHT);
      ctx.stroke();
    }
    for (let y = step; y < TABLE_HEIGHT; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(TABLE_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawAmbientStars(frame: RenderFrame): void {
    const { ctx } = this;
    ctx.save();
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(this.time * 1.4 + s.tw);
      ctx.globalAlpha = 0.25 * tw;
      ctx.fillStyle = frame.theme.particleColor;
      ctx.beginPath();
      ctx.arc(s.x * TABLE_WIDTH, s.y * TABLE_HEIGHT, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRails(frame: RenderFrame): void {
    const { ctx } = this;
    const railW = 22;
    ctx.save();
    ctx.lineWidth = railW;
    ctx.strokeStyle = frame.theme.railColor;
    roundRect(ctx, railW / 2, railW / 2, TABLE_WIDTH - railW, TABLE_HEIGHT - railW, 20);
    ctx.stroke();

    ctx.shadowColor = frame.theme.railGlow;
    ctx.shadowBlur = frame.reduceEffects ? 6 : 18;
    ctx.lineWidth = 3;
    ctx.strokeStyle = frame.theme.railGlow;
    roundRect(ctx, railW / 2, railW / 2, TABLE_WIDTH - railW, TABLE_HEIGHT - railW, 20);
    ctx.stroke();
    ctx.restore();
  }

  private drawGoals(frame: RenderFrame): void {
    const { ctx } = this;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 3);
    ctx.save();
    ctx.lineCap = 'round';

    // Top goal mouth (magenta's goal — cyan scores here).
    ctx.strokeStyle = frame.theme.teamBColor;
    ctx.shadowColor = frame.theme.teamBGlow;
    ctx.shadowBlur = frame.reduceEffects ? 4 : 14 * pulse;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(CENTER_X - GOAL_HALF_WIDTH, 2);
    ctx.lineTo(CENTER_X + GOAL_HALF_WIDTH, 2);
    ctx.stroke();

    // Bottom goal mouth (cyan's goal — magenta scores here).
    ctx.strokeStyle = frame.theme.teamAColor;
    ctx.shadowColor = frame.theme.teamAGlow;
    ctx.beginPath();
    ctx.moveTo(CENTER_X - GOAL_HALF_WIDTH, TABLE_HEIGHT - 2);
    ctx.lineTo(CENTER_X + GOAL_HALF_WIDTH, TABLE_HEIGHT - 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawCenterLine(frame: RenderFrame): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = frame.theme.centerLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(18, CENTER_Y);
    ctx.lineTo(TABLE_WIDTH - 18, CENTER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.shadowColor = frame.theme.centerGlow;
    ctx.shadowBlur = frame.reduceEffects ? 4 : 16;
    ctx.strokeStyle = frame.theme.centerGlow;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 2);
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 64, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawTrail(frame: RenderFrame): void {
    const { ctx } = this;
    ctx.save();
    for (const t of this.trail) {
      if (t.alpha < 0.03) continue;
      ctx.globalAlpha = t.alpha * 0.5;
      ctx.fillStyle = frame.theme.puckGlow;
      ctx.beginPath();
      ctx.arc(t.x, t.y, PUCK_RADIUS * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMallets(frame: RenderFrame): void {
    const { ctx } = this;
    for (const m of frame.mallets) {
      const color = m.team === 'cyan' ? frame.theme.teamAColor : frame.theme.teamBColor;
      const glow = m.team === 'cyan' ? frame.theme.teamAGlow : frame.theme.teamBGlow;
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = frame.reduceEffects ? 6 : 22;

      const grad = ctx.createRadialGradient(m.x, m.y - 6, 4, m.x, m.y, MALLET_RADIUS);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, MALLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = m.isMine ? 4 : 2;
      ctx.strokeStyle = m.isMine ? '#ffffff' : glow;
      ctx.globalAlpha = m.isMine ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, MALLET_RADIUS - 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPuck(frame: RenderFrame): void {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = frame.theme.puckGlow;
    ctx.shadowBlur = frame.reduceEffects ? 8 : 24;
    ctx.fillStyle = frame.theme.puckColor;
    ctx.beginPath();
    ctx.arc(frame.puck.x, frame.puck.y, PUCK_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawParticles(): void {
    const { ctx } = this;
    ctx.save();
    for (const p of this.particles) {
      const t = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
