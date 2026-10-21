import type { Server, Socket } from 'socket.io';
import {
  COUNTDOWN_SECONDS,
  RESET_PAUSE_SECONDS,
  SOCKET_EVENTS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  TICK_DT,
  TICK_RATE,
  WIN_SCORE,
  clampMalletToZone,
  createPuckAtCenter,
  defaultMalletSpawn,
  stepGame,
  type ArenaId,
  type GameMode,
  type GameStateSnapshot,
  type MalletState,
  type PlayerInfo,
  type PlayerSlotId,
  type PuckState,
  type RoomPhase,
  type RoomSnapshot,
  type ScoreState,
  type Team,
} from '@neon-hockey/shared';
import { generateToken } from './util.js';

interface SlotConfig {
  slot: PlayerSlotId;
  team: Team;
  lane: 0 | 1;
}

const DUEL_SLOTS: SlotConfig[] = [
  { slot: 'p1', team: 'cyan', lane: 0 },
  { slot: 'p2', team: 'magenta', lane: 0 },
];

const DOUBLE_SLOTS: SlotConfig[] = [
  { slot: 'p1', team: 'cyan', lane: 0 },
  { slot: 'p2', team: 'cyan', lane: 1 },
  { slot: 'p3', team: 'magenta', lane: 0 },
  { slot: 'p4', team: 'magenta', lane: 1 },
];

const DISCONNECT_GRACE_MS = 25_000;
const STATE_BROADCAST_EVERY_N_TICKS = 2; // 60Hz sim, 30Hz network broadcast

interface SeatedPlayer {
  info: PlayerInfo;
  socketId: string | null;
  reconnectToken: string;
  disconnectTimer: NodeJS.Timeout | null;
  lastInputSeq: number;
  rematchVote: boolean;
}

export class Room {
  readonly code: string;
  readonly mode: GameMode;
  arena: ArenaId;
  isPublic: boolean;
  phase: RoomPhase = 'lobby';
  paused = false;

  private players = new Map<PlayerSlotId, SeatedPlayer>();
  private mallets = new Map<PlayerSlotId, MalletState>();
  private puck: PuckState = createPuckAtCenter();
  private score: ScoreState = { cyan: 0, magenta: 0 };
  private servingTeam: Team = 'cyan';
  private winner: Team | null = null;
  private countdownRemainingMs = 0;
  private lastBroadcastCountdown: number | null = null;
  private goalPauseRemainingMs = 0;
  private matchStartedAt = 0;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;

  private readonly io: Server;
  private readonly onEmpty: (code: string) => void;

  constructor(opts: {
    code: string;
    mode: GameMode;
    arena: ArenaId;
    isPublic: boolean;
    io: Server;
    onEmpty: (code: string) => void;
  }) {
    this.code = opts.code;
    this.mode = opts.mode;
    this.arena = opts.arena;
    this.isPublic = opts.isPublic;
    this.io = opts.io;
    this.onEmpty = opts.onEmpty;
  }

  get slotConfig(): SlotConfig[] {
    return this.mode === 'duel' ? DUEL_SLOTS : DOUBLE_SLOTS;
  }

  get maxPlayers(): number {
    return this.slotConfig.length;
  }

  get seatedCount(): number {
    return this.players.size;
  }

  private freeSlot(): SlotConfig | null {
    for (const sc of this.slotConfig) {
      if (!this.players.has(sc.slot)) return sc;
    }
    return null;
  }

  /** Seats a brand-new player (not a reconnection). Returns their slot + a
   * private reconnect token, or null if the room is full. */
  addPlayer(socket: Socket, nickname: string, avatar: string, autoReady: boolean): { slot: PlayerSlotId; token: string } | null {
    const sc = this.freeSlot();
    if (!sc) return null;

    const token = generateToken();
    const info: PlayerInfo = {
      id: socket.id,
      slot: sc.slot,
      team: sc.team,
      nickname,
      avatar,
      connected: true,
      ready: autoReady,
    };
    this.players.set(sc.slot, {
      info,
      socketId: socket.id,
      reconnectToken: token,
      disconnectTimer: null,
      lastInputSeq: -1,
      rematchVote: false,
    });

    const spawn = defaultMalletSpawn(sc.team, sc.lane);
    this.mallets.set(sc.slot, {
      playerId: sc.slot,
      team: sc.team,
      x: spawn.x,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      vx: 0,
      vy: 0,
    });

    socket.join(this.code);
    socket.data.roomCode = this.code;
    socket.data.slot = sc.slot;

    this.broadcastRoomUpdate();
    this.maybeAutoStart();
    return { slot: sc.slot, token };
  }

  reconnect(socket: Socket, token: string): PlayerSlotId | null {
    for (const [slot, seated] of this.players) {
      if (seated.reconnectToken === token && seated.socketId === null) {
        if (seated.disconnectTimer) {
          clearTimeout(seated.disconnectTimer);
          seated.disconnectTimer = null;
        }
        seated.socketId = socket.id;
        seated.info.id = socket.id;
        seated.info.connected = true;
        socket.join(this.code);
        socket.data.roomCode = this.code;
        socket.data.slot = slot;

        this.io.to(this.code).emit(SOCKET_EVENTS.OPPONENT_RECONNECTED, {
          slot,
          nickname: seated.info.nickname,
        });

        if (this.allSeatedConnected()) {
          this.paused = false;
        }
        this.broadcastRoomUpdate();
        return slot;
      }
    }
    return null;
  }

  setReady(slot: PlayerSlotId, ready: boolean): void {
    const seated = this.players.get(slot);
    if (!seated) return;
    seated.info.ready = ready;
    this.broadcastRoomUpdate();
    this.maybeAutoStart();
  }

  setArena(arena: ArenaId): void {
    if (this.phase !== 'lobby') return;
    this.arena = arena;
    this.broadcastRoomUpdate();
  }

  setInput(slot: PlayerSlotId, x: number, y: number, seq: number): void {
    const seated = this.players.get(slot);
    const mallet = this.mallets.get(slot);
    if (!seated || !mallet) return;
    if (seq <= seated.lastInputSeq) return; // stale / out-of-order, drop
    seated.lastInputSeq = seq;

    // Re-clamp on the server no matter what the client sent — this is the
    // boundary that stops a modified client from placing a mallet anywhere.
    mallet.targetX = clampNum(x, 0, TABLE_WIDTH);
    mallet.targetY = clampNum(y, 0, TABLE_HEIGHT);
    clampMalletToZone(mallet);
    // clampMalletToZone clamps mallet.x/y, not the target directly when the
    // target itself is out of zone — mirror that onto the target so stepMallet
    // doesn't fight to re-enter a forbidden zone every tick.
    const temp: MalletState = { ...mallet, x: mallet.targetX, y: mallet.targetY };
    clampMalletToZone(temp);
    mallet.targetX = temp.x;
    mallet.targetY = temp.y;
  }

  voteRematch(slot: PlayerSlotId): { votes: number; needed: number } {
    const seated = this.players.get(slot);
    if (seated) seated.rematchVote = true;
    const connected = [...this.players.values()].filter((p) => p.info.connected);
    const votes = connected.filter((p) => p.rematchVote).length;
    const needed = connected.length;

    this.io.to(this.code).emit(SOCKET_EVENTS.REMATCH_STATUS, { votes, needed });

    if (this.phase === 'finished' && votes >= needed && needed > 0) {
      this.resetForRematch();
    }
    return { votes, needed };
  }

  handleDisconnect(socketId: string): { empty: boolean } {
    let foundSlot: PlayerSlotId | null = null;
    for (const [slot, seated] of this.players) {
      if (seated.socketId === socketId) {
        foundSlot = slot;
        break;
      }
    }
    if (!foundSlot) return { empty: this.players.size === 0 };

    const seated = this.players.get(foundSlot)!;

    if (this.phase === 'lobby' || this.phase === 'finished') {
      // No match to protect with a reconnect grace period — a lobby seat or a
      // finished match's seat can just be vacated outright. Without this, a
      // room whose players close the tab after seeing the result screen would
      // never leave the server's room map.
      this.players.delete(foundSlot);
      this.mallets.delete(foundSlot);
      this.broadcastRoomUpdate();
      const empty = this.players.size === 0;
      if (empty) this.destroy();
      return { empty };
    }

    seated.socketId = null;
    seated.info.connected = false;
    this.paused = true;

    this.io.to(this.code).emit(SOCKET_EVENTS.OPPONENT_DISCONNECTED, {
      slot: foundSlot,
      nickname: seated.info.nickname,
      timeoutSeconds: DISCONNECT_GRACE_MS / 1000,
    });
    this.broadcastRoomUpdate();

    seated.disconnectTimer = setTimeout(() => this.forfeitFor(foundSlot!), DISCONNECT_GRACE_MS);
    return { empty: false };
  }

  /** A deliberate "Quitter" click, as opposed to a dropped connection — the
   * player is not coming back, so there is no reconnect grace period and no
   * scary "disconnected, reconnecting…" banner for the remaining player(s). */
  explicitLeave(socketId: string): { empty: boolean } {
    let foundSlot: PlayerSlotId | null = null;
    for (const [slot, seated] of this.players) {
      if (seated.socketId === socketId) {
        foundSlot = slot;
        break;
      }
    }
    if (!foundSlot) return { empty: this.players.size === 0 };

    const seated = this.players.get(foundSlot)!;

    if (this.phase === 'lobby' || this.phase === 'finished') {
      this.players.delete(foundSlot);
      this.mallets.delete(foundSlot);
      this.broadcastRoomUpdate();
      const empty = this.players.size === 0;
      if (empty) this.destroy();
      return { empty };
    }

    // A live match can't continue short a player — concede it immediately
    // to the opposing team, then vacate the seat outright.
    if (seated.disconnectTimer) clearTimeout(seated.disconnectTimer);
    this.concludeAsForfeit(seated.info.team);
    this.players.delete(foundSlot);
    this.mallets.delete(foundSlot);
    this.broadcastRoomUpdate();
    return { empty: this.players.size === 0 };
  }

  private forfeitFor(disconnectedSlot: PlayerSlotId): void {
    const seated = this.players.get(disconnectedSlot);
    if (!seated || seated.socketId !== null) return; // reconnected in time
    if (this.phase === 'finished') return;
    this.concludeAsForfeit(seated.info.team);
    this.broadcastRoomUpdate();
  }

  private concludeAsForfeit(leavingTeam: Team): void {
    const winner: Team = leavingTeam === 'cyan' ? 'magenta' : 'cyan';
    this.winner = winner;
    this.phase = 'finished';
    this.stopTickLoop();

    this.io.to(this.code).emit(SOCKET_EVENTS.MATCH_RESULT, {
      winner,
      score: this.score,
      durationMs: this.matchStartedAt ? Date.now() - this.matchStartedAt : 0,
      roomCode: this.code,
    });
    this.broadcastState();
  }

  private allSeatedConnected(): boolean {
    if (this.players.size < this.maxPlayers) return false;
    return [...this.players.values()].every((p) => p.info.connected);
  }

  private maybeAutoStart(): void {
    if (this.phase !== 'lobby') return;
    if (this.players.size < this.maxPlayers) return;
    const allReady = [...this.players.values()].every((p) => p.info.ready);
    if (!allReady) return;
    this.startCountdown();
  }

  private startCountdown(): void {
    this.phase = 'countdown';
    this.countdownRemainingMs = COUNTDOWN_SECONDS * 1000;
    this.lastBroadcastCountdown = null;
    this.resetPositions();
    this.startTickLoop();
    this.broadcastRoomUpdate();
  }

  private resetForRematch(): void {
    this.score = { cyan: 0, magenta: 0 };
    this.winner = null;
    for (const seated of this.players.values()) seated.rematchVote = false;
    this.startCountdown();
  }

  private resetPositions(): void {
    this.puck = createPuckAtCenter();
    for (const sc of this.slotConfig) {
      const mallet = this.mallets.get(sc.slot);
      if (!mallet) continue;
      const spawn = defaultMalletSpawn(sc.team, sc.lane);
      mallet.x = spawn.x;
      mallet.y = spawn.y;
      mallet.targetX = spawn.x;
      mallet.targetY = spawn.y;
      mallet.vx = 0;
      mallet.vy = 0;
    }
  }

  private startTickLoop(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  private stopTickLoop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick(): void {
    this.tickCount++;

    if (this.paused) {
      this.broadcastStateThrottled();
      return;
    }

    if (this.phase === 'countdown') {
      this.countdownRemainingMs -= 1000 / TICK_RATE;
      const value = Math.max(0, Math.ceil(this.countdownRemainingMs / 1000));
      if (value !== this.lastBroadcastCountdown) {
        this.lastBroadcastCountdown = value;
        this.io.to(this.code).emit(SOCKET_EVENTS.COUNTDOWN_TICK, { value });
      }
      if (this.countdownRemainingMs <= 0) {
        this.phase = 'playing';
        this.matchStartedAt = Date.now();
        // RoomSnapshot.phase is the only phase field a few UI flows read (e.g.
        // deciding whether to show the match screen) — every transition past
        // the initial countdown must re-broadcast it, or the client sees a
        // permanently stale 'countdown' and can misbehave once the match ends.
        this.broadcastRoomUpdate();
      }
    } else if (this.phase === 'playing') {
      const malletList = [...this.mallets.values()];
      const goal = stepGame(this.puck, malletList, TICK_DT);
      if (goal) {
        this.handleGoal(goal.scoringTeam);
      }
    } else if (this.phase === 'goal-pause') {
      this.goalPauseRemainingMs -= 1000 / TICK_RATE;
      if (this.goalPauseRemainingMs <= 0) {
        this.phase = 'playing';
        this.broadcastRoomUpdate();
      }
    }

    this.broadcastStateThrottled();
  }

  private handleGoal(scoringTeam: Team): void {
    this.score[scoringTeam]++;
    this.io.to(this.code).emit(SOCKET_EVENTS.GOAL, {
      scoringTeam,
      cyan: this.score.cyan,
      magenta: this.score.magenta,
      scoredAtMs: Date.now(),
    });

    if (this.score[scoringTeam] >= WIN_SCORE) {
      this.winner = scoringTeam;
      this.phase = 'finished';
      this.io.to(this.code).emit(SOCKET_EVENTS.MATCH_RESULT, {
        winner: scoringTeam,
        score: this.score,
        durationMs: Date.now() - this.matchStartedAt,
        roomCode: this.code,
      });
      this.stopTickLoop();
      this.broadcastRoomUpdate();
    } else {
      this.servingTeam = scoringTeam === 'cyan' ? 'magenta' : 'cyan';
      this.phase = 'goal-pause';
      this.goalPauseRemainingMs = RESET_PAUSE_SECONDS * 1000;
      this.resetPositions();
      this.broadcastRoomUpdate();
    }
  }

  private broadcastStateThrottled(): void {
    if (this.tickCount % STATE_BROADCAST_EVERY_N_TICKS === 0) {
      this.broadcastState();
    }
  }

  private broadcastState(): void {
    const snapshot: GameStateSnapshot = {
      tick: this.tickCount,
      serverTimeMs: Date.now(),
      phase: this.phase,
      countdownValue: this.phase === 'countdown' ? this.lastBroadcastCountdown : null,
      puck: this.puck,
      mallets: [...this.mallets.values()],
      score: this.score,
      servingTeam: this.servingTeam,
      winner: this.winner,
      matchDurationMs: this.matchStartedAt ? Date.now() - this.matchStartedAt : 0,
    };
    this.io.to(this.code).volatile.emit(SOCKET_EVENTS.STATE, snapshot);
  }

  broadcastRoomUpdate(): void {
    const snapshot: RoomSnapshot = {
      roomCode: this.code,
      mode: this.mode,
      arena: this.arena,
      phase: this.phase,
      players: this.slotConfig
        .map((sc) => this.players.get(sc.slot)?.info)
        .filter((p): p is PlayerInfo => !!p),
      maxPlayers: this.maxPlayers,
      isPublic: this.isPublic,
    };
    this.io.to(this.code).emit(SOCKET_EVENTS.ROOM_UPDATE, snapshot);
  }

  destroy(): void {
    this.stopTickLoop();
    for (const seated of this.players.values()) {
      if (seated.disconnectTimer) clearTimeout(seated.disconnectTimer);
    }
    this.onEmpty(this.code);
  }
}

function clampNum(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}
