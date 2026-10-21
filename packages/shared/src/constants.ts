// Logical table coordinate space. Client scales this to the actual canvas size,
// keeping aspect ratio — this is the single source of truth for every geometry
// calculation on both client and server.
export const TABLE_WIDTH = 760;
export const TABLE_HEIGHT = 1180;

export const PUCK_RADIUS = 18;
export const MALLET_RADIUS = 34;

// Goal mouth centered on each short edge.
export const GOAL_WIDTH = 230;
export const GOAL_HALF_WIDTH = GOAL_WIDTH / 2;

// Simulation tuning. Units are table-units / second.
export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

export const PUCK_MAX_SPEED = 1500;
export const PUCK_MIN_SPEED_TO_STOP = 4; // below this, treat as stopped (avoid jitter)
export const PUCK_LINEAR_DAMPING = 0.35; // fraction of speed lost per second
export const WALL_RESTITUTION = 0.9;
export const MALLET_RESTITUTION = 1.05; // mallets inject a bit of energy back (a "hit")

// Server clamps how far a mallet may travel per tick, independent of the
// client-reported target — this is the core anti-teleport / anti-speedhack guard.
export const MALLET_MAX_SPEED = 2600;

export const WIN_SCORE = 7;
export const COUNTDOWN_SECONDS = 3;
export const RESET_PAUSE_SECONDS = 1.1; // pause after a goal before puck/mallets reset

// Continuous collision: puck movement is split into sub-steps so it can never
// cross a wall or mallet boundary within a single tick, regardless of speed.
export const MAX_SUBSTEP_DISPLACEMENT = PUCK_RADIUS * 0.5;
export const MAX_SUBSTEPS = 12;

export type GameMode = 'duel' | 'double';
export type Team = 'cyan' | 'magenta';

export const ARENA_IDS = ['cyber-blue', 'neon-pulse', 'reactor', 'solar-flare', 'galaxy'] as const;
export type ArenaId = (typeof ARENA_IDS)[number];
