import {
  GOAL_HALF_WIDTH,
  MALLET_MAX_SPEED,
  MALLET_RADIUS,
  MALLET_RESTITUTION,
  MAX_SUBSTEP_DISPLACEMENT,
  MAX_SUBSTEPS,
  PUCK_LINEAR_DAMPING,
  PUCK_MAX_SPEED,
  PUCK_MIN_SPEED_TO_STOP,
  PUCK_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  WALL_RESTITUTION,
  type Team,
} from './constants.js';
import type { MalletState, PuckState } from './types.js';

const CENTER_X = TABLE_WIDTH / 2;
const CENTER_Y = TABLE_HEIGHT / 2;

export function teamZoneBounds(team: Team) {
  // cyan defends the bottom goal and stays in the bottom half; magenta mirrors it.
  if (team === 'cyan') {
    return {
      minY: CENTER_Y + MALLET_RADIUS,
      maxY: TABLE_HEIGHT - MALLET_RADIUS,
    };
  }
  return {
    minY: MALLET_RADIUS,
    maxY: CENTER_Y - MALLET_RADIUS,
  };
}

export function clampMalletToZone(mallet: MalletState): void {
  const { minY, maxY } = teamZoneBounds(mallet.team);
  mallet.x = clamp(mallet.x, MALLET_RADIUS, TABLE_WIDTH - MALLET_RADIUS);
  mallet.y = clamp(mallet.y, minY, maxY);
}

export function createPuckAtCenter(): PuckState {
  return { x: CENTER_X, y: CENTER_Y, vx: 0, vy: 0 };
}

export function defaultMalletSpawn(team: Team, laneIndex: 0 | 1): { x: number; y: number } {
  const { minY, maxY } = teamZoneBounds(team);
  // laneIndex only matters in 2v2 (two teammates share a half) — spread them
  // left/right so they don't spawn stacked on top of each other.
  const x = laneIndex === 0 ? TABLE_WIDTH * 0.32 : TABLE_WIDTH * 0.68;
  const y = team === 'cyan' ? minY + (maxY - minY) * 0.22 : maxY - (maxY - minY) * 0.22;
  return { x, y };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function lengthOf(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Moves a mallet toward its latest input target, clamped to a max server speed
 * (the core anti-teleport guard) and to the player's legal zone. */
export function stepMallet(mallet: MalletState, dt: number): void {
  const dx = mallet.targetX - mallet.x;
  const dy = mallet.targetY - mallet.y;
  const dist = lengthOf(dx, dy);
  const maxStep = MALLET_MAX_SPEED * dt;

  if (dist <= maxStep || dist < 1e-6) {
    mallet.vx = dist > 1e-6 ? dx / dt : 0;
    mallet.vy = dist > 1e-6 ? dy / dt : 0;
    mallet.x = mallet.targetX;
    mallet.y = mallet.targetY;
  } else {
    const nx = dx / dist;
    const ny = dy / dist;
    mallet.vx = nx * MALLET_MAX_SPEED;
    mallet.vy = ny * MALLET_MAX_SPEED;
    mallet.x += nx * maxStep;
    mallet.y += ny * maxStep;
  }

  clampMalletToZone(mallet);
}

/** Resolves overlap between mallets on the same team (2v2 only — opposing
 * mallets can never meet because the center line separates their zones). */
export function resolveMalletCollisions(mallets: MalletState[]): void {
  for (let i = 0; i < mallets.length; i++) {
    for (let j = i + 1; j < mallets.length; j++) {
      const a = mallets[i];
      const b = mallets[j];
      if (a.team !== b.team) continue; // different-team mallets can't physically touch
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = lengthOf(dx, dy);
      const minDist = MALLET_RADIUS * 2;
      if (dist > 0 && dist < minDist) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;
        clampMalletToZone(a);
        clampMalletToZone(b);
      }
    }
  }
}

export interface GoalResult {
  scoringTeam: Team;
}

/** Advances the puck by `dt`, split into fixed-length sub-steps so a fast
 * puck can never tunnel through a wall or mallet within one server tick. */
export function stepPuck(puck: PuckState, mallets: MalletState[], dt: number): GoalResult | null {
  const speed = lengthOf(puck.vx, puck.vy);
  const totalDisplacement = speed * dt;
  const substeps = Math.min(
    MAX_SUBSTEPS,
    Math.max(1, Math.ceil(totalDisplacement / MAX_SUBSTEP_DISPLACEMENT)),
  );
  const subDt = dt / substeps;

  for (let s = 0; s < substeps; s++) {
    puck.x += puck.vx * subDt;
    puck.y += puck.vy * subDt;

    const goal = resolveWallCollisions(puck);
    if (goal) return goal;

    for (const mallet of mallets) {
      resolvePuckMalletCollision(puck, mallet);
    }
  }

  applyDamping(puck, dt);
  return null;
}

function resolveWallCollisions(puck: PuckState): GoalResult | null {
  // Left / right walls — always solid.
  if (puck.x - PUCK_RADIUS < 0) {
    puck.x = PUCK_RADIUS;
    puck.vx = Math.abs(puck.vx) * WALL_RESTITUTION;
  } else if (puck.x + PUCK_RADIUS > TABLE_WIDTH) {
    puck.x = TABLE_WIDTH - PUCK_RADIUS;
    puck.vx = -Math.abs(puck.vx) * WALL_RESTITUTION;
  }

  const withinGoalMouthX = puck.x > CENTER_X - GOAL_HALF_WIDTH && puck.x < CENTER_X + GOAL_HALF_WIDTH;

  // Top wall belongs to the magenta goal — if the puck fully clears it, cyan scores.
  if (puck.y - PUCK_RADIUS < 0) {
    if (withinGoalMouthX) {
      if (puck.y + PUCK_RADIUS < 0) {
        return { scoringTeam: 'cyan' };
      }
      // inside the goal mouth gap but not fully through yet — let it coast, no wall.
    } else {
      puck.y = PUCK_RADIUS;
      puck.vy = Math.abs(puck.vy) * WALL_RESTITUTION;
    }
  }

  // Bottom wall belongs to the cyan goal — if the puck fully clears it, magenta scores.
  if (puck.y + PUCK_RADIUS > TABLE_HEIGHT) {
    if (withinGoalMouthX) {
      if (puck.y - PUCK_RADIUS > TABLE_HEIGHT) {
        return { scoringTeam: 'magenta' };
      }
    } else {
      puck.y = TABLE_HEIGHT - PUCK_RADIUS;
      puck.vy = -Math.abs(puck.vy) * WALL_RESTITUTION;
    }
  }

  return null;
}

function resolvePuckMalletCollision(puck: PuckState, mallet: MalletState): void {
  const dx = puck.x - mallet.x;
  const dy = puck.y - mallet.y;
  const dist = lengthOf(dx, dy);
  const minDist = PUCK_RADIUS + MALLET_RADIUS;
  if (dist >= minDist || dist < 1e-6) return;

  const nx = dx / dist;
  const ny = dy / dist;

  // Push the puck out so it never overlaps the mallet (mallet doesn't move — it's player-controlled).
  puck.x = mallet.x + nx * minDist;
  puck.y = mallet.y + ny * minDist;

  // Relative velocity along the normal, reflected, plus the mallet's own
  // velocity so a fast-moving strike actually accelerates the puck.
  const relVx = puck.vx - mallet.vx;
  const relVy = puck.vy - mallet.vy;
  const relDotN = relVx * nx + relVy * ny;

  if (relDotN < 0) {
    const reflectedVx = relVx - 2 * relDotN * nx;
    const reflectedVy = relVy - 2 * relDotN * ny;
    puck.vx = reflectedVx * MALLET_RESTITUTION + mallet.vx;
    puck.vy = reflectedVy * MALLET_RESTITUTION + mallet.vy;
  } else {
    // Already separating (e.g. mallet swept through) — still impart mallet momentum.
    puck.vx += mallet.vx * 0.4;
    puck.vy += mallet.vy * 0.4;
  }

  clampPuckSpeed(puck);
}

function clampPuckSpeed(puck: PuckState): void {
  const speed = lengthOf(puck.vx, puck.vy);
  if (speed > PUCK_MAX_SPEED) {
    const scale = PUCK_MAX_SPEED / speed;
    puck.vx *= scale;
    puck.vy *= scale;
  }
}

function applyDamping(puck: PuckState, dt: number): void {
  const factor = Math.max(0, 1 - PUCK_LINEAR_DAMPING * dt);
  puck.vx *= factor;
  puck.vy *= factor;
  if (lengthOf(puck.vx, puck.vy) < PUCK_MIN_SPEED_TO_STOP) {
    puck.vx = 0;
    puck.vy = 0;
  }
}

/** One full authoritative tick: mallets, puck, collisions. Returns a goal
 * result if one occurred so the caller (server) can update score and reset. */
export function stepGame(
  puck: PuckState,
  mallets: MalletState[],
  dt: number,
): GoalResult | null {
  for (const mallet of mallets) {
    stepMallet(mallet, dt);
  }
  resolveMalletCollisions(mallets);
  return stepPuck(puck, mallets, dt);
}
