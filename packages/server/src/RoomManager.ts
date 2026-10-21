import type { Server, Socket } from 'socket.io';
import {
  ARENA_IDS,
  SOCKET_EVENTS,
  type ArenaId,
  type GameMode,
  type SeatedPayload,
} from '@neon-hockey/shared';
import { Room } from './Room.js';
import { generateRoomCode } from './util.js';

interface QueueTicket {
  socket: Socket;
  nickname: string;
  avatar: string;
}

const MODE_SIZE: Record<GameMode, number> = { duel: 2, double: 4 };

export class RoomManager {
  private rooms = new Map<string, Room>();
  private queues: Record<GameMode, QueueTicket[]> = { duel: [], double: [] };
  private readonly io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  get onlineRoomCount(): number {
    return this.rooms.size;
  }

  private newRoomCode(): string {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    return code;
  }

  private randomArena(): ArenaId {
    return ARENA_IDS[Math.floor(Math.random() * ARENA_IDS.length)];
  }

  createRoom(
    socket: Socket,
    opts: { mode: GameMode; arena: ArenaId; isPublic: boolean; nickname: string; avatar: string },
  ): SeatedPayload {
    const code = this.newRoomCode();
    const room = new Room({
      code,
      mode: opts.mode,
      arena: opts.arena,
      isPublic: opts.isPublic,
      io: this.io,
      onEmpty: (c) => this.rooms.delete(c),
    });
    this.rooms.set(code, room);

    const seat = room.addPlayer(socket, opts.nickname, opts.avatar, /* autoReady */ false)!;
    return { roomCode: code, slot: seat.slot, token: seat.token, mode: room.mode, arena: room.arena };
  }

  joinRoom(
    socket: Socket,
    opts: { roomCode: string; nickname: string; avatar: string },
  ): { ok: true; payload: SeatedPayload } | { ok: false; code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' } {
    const room = this.rooms.get(opts.roomCode.toUpperCase());
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };

    const seat = room.addPlayer(socket, opts.nickname, opts.avatar, false);
    if (!seat) return { ok: false, code: 'ROOM_FULL' };

    return {
      ok: true,
      payload: { roomCode: room.code, slot: seat.slot, token: seat.token, mode: room.mode, arena: room.arena },
    };
  }

  quickMatch(socket: Socket, opts: { mode: GameMode; nickname: string; avatar: string }): void {
    const queue = this.queues[opts.mode];
    queue.push({ socket, nickname: opts.nickname, avatar: opts.avatar });
    socket.data.queuedMode = opts.mode;

    const needed = MODE_SIZE[opts.mode];
    if (queue.length < needed) {
      socket.emit(SOCKET_EVENTS.SEARCHING, { mode: opts.mode, waiting: queue.length, needed });
      return;
    }

    const tickets = queue.splice(0, needed);
    const code = this.newRoomCode();
    const room = new Room({
      code,
      mode: opts.mode,
      arena: this.randomArena(),
      isPublic: true,
      io: this.io,
      onEmpty: (c) => this.rooms.delete(c),
    });
    this.rooms.set(code, room);

    for (const ticket of tickets) {
      delete ticket.socket.data.queuedMode;
      const seat = room.addPlayer(ticket.socket, ticket.nickname, ticket.avatar, /* autoReady */ true);
      if (!seat) continue;
      const payload: SeatedPayload = {
        roomCode: code,
        slot: seat.slot,
        token: seat.token,
        mode: room.mode,
        arena: room.arena,
      };
      ticket.socket.emit(SOCKET_EVENTS.SEATED, payload);
      ticket.socket.emit(SOCKET_EVENTS.MATCH_FOUND, payload);
    }
  }

  cancelQuickMatch(socket: Socket): void {
    const mode = socket.data.queuedMode as GameMode | undefined;
    if (!mode) return;
    const queue = this.queues[mode];
    const idx = queue.findIndex((t) => t.socket.id === socket.id);
    if (idx >= 0) queue.splice(idx, 1);
    delete socket.data.queuedMode;
  }

  rejoin(socket: Socket, opts: { roomCode: string; token: string }): SeatedPayload | null {
    const room = this.rooms.get(opts.roomCode.toUpperCase());
    if (!room) return null;
    const slot = room.reconnect(socket, opts.token);
    if (!slot) return null;
    return { roomCode: room.code, slot, token: opts.token, mode: room.mode, arena: room.arena };
  }

  getRoomForSocket(socket: Socket): Room | null {
    const code = socket.data.roomCode as string | undefined;
    if (!code) return null;
    return this.rooms.get(code) ?? null;
  }

  handleDisconnect(socket: Socket): void {
    this.cancelQuickMatch(socket);
    const room = this.getRoomForSocket(socket);
    if (!room) return;
    room.handleDisconnect(socket.id);
  }
}
