import type { ArenaId, GameMode, Team } from './constants.js';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PuckState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** A single mallet (one human player's striker) in the simulation. */
export interface MalletState {
  playerId: string;
  team: Team;
  x: number;
  y: number;
  // Latest input target (where the player's cursor/finger is, in table space).
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
}

export type PlayerSlotId = 'p1' | 'p2' | 'p3' | 'p4';

export interface PlayerInfo {
  id: string; // socket id
  slot: PlayerSlotId;
  team: Team;
  nickname: string;
  avatar: string; // emoji or short code, no uploads needed
  connected: boolean;
  ready: boolean;
}

export type RoomPhase =
  | 'lobby' // waiting for players
  | 'countdown' // 3..2..1
  | 'playing'
  | 'goal-pause' // brief freeze after a goal before reset
  | 'finished'; // someone reached WIN_SCORE

export interface ScoreState {
  cyan: number;
  magenta: number;
}

export interface GoalEvent {
  scoringTeam: Team;
  cyan: number;
  magenta: number;
  scoredAtMs: number;
}

export interface RoomSnapshot {
  roomCode: string;
  mode: GameMode;
  arena: ArenaId;
  phase: RoomPhase;
  players: PlayerInfo[];
  maxPlayers: number;
  isPublic: boolean;
}

/** Full authoritative state broadcast to clients every tick. */
export interface GameStateSnapshot {
  tick: number;
  serverTimeMs: number;
  phase: RoomPhase;
  countdownValue: number | null;
  puck: PuckState;
  mallets: MalletState[];
  score: ScoreState;
  servingTeam: Team;
  winner: Team | null;
  matchDurationMs: number;
}

// ---- Client -> Server events ----

export interface InputMessage {
  x: number; // target position in table-space, clamped client-side for UX but re-clamped server-side
  y: number;
  seq: number; // monotonically increasing, lets server drop stale/out-of-order input
}

export interface CreateRoomRequest {
  mode: GameMode;
  arena: ArenaId;
  isPublic: boolean;
  nickname: string;
  avatar: string;
}

export interface JoinRoomRequest {
  roomCode: string;
  nickname: string;
  avatar: string;
}

export interface QuickMatchRequest {
  mode: GameMode;
  nickname: string;
  avatar: string;
}

export interface RematchVote {
  roomCode: string;
}

export interface RejoinRequest {
  roomCode: string;
  token: string;
}

/** Sent privately to a single socket right after it takes a seat — carries
 * the reconnect token, which must never be broadcast in a RoomSnapshot. */
export interface SeatedPayload {
  roomCode: string;
  slot: PlayerSlotId;
  token: string;
  mode: GameMode;
  arena: ArenaId;
}

// ---- Server -> Client events ----

export interface ErrorPayload {
  code:
    | 'ROOM_NOT_FOUND'
    | 'ROOM_FULL'
    | 'INVALID_NAME'
    | 'ALREADY_IN_ROOM'
    | 'NOT_IN_ROOM'
    | 'SERVER_ERROR';
  message: string;
}

export interface MatchResultPayload {
  winner: Team;
  score: ScoreState;
  durationMs: number;
  roomCode: string;
}

export const SOCKET_EVENTS = {
  // client -> server
  QUICK_MATCH: 'quick_match',
  CANCEL_QUICK_MATCH: 'cancel_quick_match',
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SET_READY: 'set_ready',
  INPUT: 'input',
  VOTE_REMATCH: 'vote_rematch',
  SET_ARENA: 'set_arena',
  REJOIN_ROOM: 'rejoin_room',

  // server -> client
  SEATED: 'seated',
  ROOM_UPDATE: 'room_update',
  SEARCHING: 'searching',
  MATCH_FOUND: 'match_found',
  COUNTDOWN_TICK: 'countdown_tick',
  STATE: 'state',
  GOAL: 'goal',
  MATCH_RESULT: 'match_result',
  REMATCH_STATUS: 'rematch_status',
  OPPONENT_DISCONNECTED: 'opponent_disconnected',
  OPPONENT_RECONNECTED: 'opponent_reconnected',
  ONLINE_COUNT: 'online_count',
  ERROR: 'error_event',
} as const;
