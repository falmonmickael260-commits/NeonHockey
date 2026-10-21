import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import {
  ARENA_IDS,
  SOCKET_EVENTS,
  type ArenaId,
  type CreateRoomRequest,
  type ErrorPayload,
  type GameMode,
  type InputMessage,
  type JoinRoomRequest,
  type QuickMatchRequest,
  type RejoinRequest,
} from '@neon-hockey/shared';
import { RoomManager } from './RoomManager.js';
import { sanitizeAvatar, sanitizeNickname } from './util.js';

const PORT = Number(process.env.PORT ?? 8787);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

const roomManager = new RoomManager(io);

function isGameMode(v: unknown): v is GameMode {
  return v === 'duel' || v === 'double';
}
function isArena(v: unknown): v is ArenaId {
  return typeof v === 'string' && (ARENA_IDS as readonly string[]).includes(v);
}

function sendError(socket: import('socket.io').Socket, payload: ErrorPayload): void {
  socket.emit(SOCKET_EVENTS.ERROR, payload);
}

function broadcastOnlineCount(): void {
  io.emit(SOCKET_EVENTS.ONLINE_COUNT, { count: io.engine.clientsCount });
}

io.on('connection', (socket) => {
  broadcastOnlineCount();

  socket.on(SOCKET_EVENTS.QUICK_MATCH, (req: QuickMatchRequest) => {
    if (!isGameMode(req?.mode)) return sendError(socket, { code: 'SERVER_ERROR', message: 'Mode invalide.' });
    if (socket.data.roomCode) return sendError(socket, { code: 'ALREADY_IN_ROOM', message: 'Déjà dans une partie.' });
    roomManager.quickMatch(socket, {
      mode: req.mode,
      nickname: sanitizeNickname(req.nickname),
      avatar: sanitizeAvatar(req.avatar),
    });
  });

  socket.on(SOCKET_EVENTS.CANCEL_QUICK_MATCH, () => {
    roomManager.cancelQuickMatch(socket);
  });

  socket.on(SOCKET_EVENTS.CREATE_ROOM, (req: CreateRoomRequest) => {
    if (!isGameMode(req?.mode) || !isArena(req?.arena)) {
      return sendError(socket, { code: 'SERVER_ERROR', message: 'Paramètres de salon invalides.' });
    }
    if (socket.data.roomCode) return sendError(socket, { code: 'ALREADY_IN_ROOM', message: 'Déjà dans une partie.' });
    const payload = roomManager.createRoom(socket, {
      mode: req.mode,
      arena: req.arena,
      isPublic: !!req.isPublic,
      nickname: sanitizeNickname(req.nickname),
      avatar: sanitizeAvatar(req.avatar),
    });
    socket.emit(SOCKET_EVENTS.SEATED, payload);
  });

  socket.on(SOCKET_EVENTS.JOIN_ROOM, (req: JoinRoomRequest) => {
    if (!req?.roomCode) return sendError(socket, { code: 'ROOM_NOT_FOUND', message: 'Code de salon manquant.' });
    if (socket.data.roomCode) return sendError(socket, { code: 'ALREADY_IN_ROOM', message: 'Déjà dans une partie.' });
    const result = roomManager.joinRoom(socket, {
      roomCode: req.roomCode,
      nickname: sanitizeNickname(req.nickname),
      avatar: sanitizeAvatar(req.avatar),
    });
    if (!result.ok) {
      const message = result.code === 'ROOM_NOT_FOUND' ? 'Salon introuvable.' : 'Le salon est complet.';
      return sendError(socket, { code: result.code, message });
    }
    socket.emit(SOCKET_EVENTS.SEATED, result.payload);
  });

  socket.on(SOCKET_EVENTS.REJOIN_ROOM, (req: RejoinRequest) => {
    if (!req?.roomCode || !req?.token) return;
    const payload = roomManager.rejoin(socket, req);
    if (!payload) return sendError(socket, { code: 'ROOM_NOT_FOUND', message: 'Reconnexion impossible.' });
    socket.emit(SOCKET_EVENTS.SEATED, payload);
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
    const room = roomManager.getRoomForSocket(socket);
    if (!room) return;
    // Leave the socket.io room FIRST — explicitLeave broadcasts to it, and the
    // player who just quit should not receive their own departure messages.
    socket.leave(room.code);
    room.explicitLeave(socket.id);
    delete socket.data.roomCode;
    delete socket.data.slot;
  });

  socket.on(SOCKET_EVENTS.SET_READY, (req: { ready: boolean }) => {
    const room = roomManager.getRoomForSocket(socket);
    const slot = socket.data.slot;
    if (!room || !slot) return sendError(socket, { code: 'NOT_IN_ROOM', message: "Vous n'êtes dans aucun salon." });
    room.setReady(slot, !!req?.ready);
  });

  socket.on(SOCKET_EVENTS.SET_ARENA, (req: { arena: ArenaId }) => {
    const room = roomManager.getRoomForSocket(socket);
    if (!room || !isArena(req?.arena)) return;
    room.setArena(req.arena);
  });

  socket.on(SOCKET_EVENTS.INPUT, (msg: InputMessage) => {
    const room = roomManager.getRoomForSocket(socket);
    const slot = socket.data.slot;
    if (!room || !slot) return;
    if (typeof msg?.x !== 'number' || typeof msg?.y !== 'number' || typeof msg?.seq !== 'number') return;
    room.setInput(slot, msg.x, msg.y, msg.seq);
  });

  socket.on(SOCKET_EVENTS.VOTE_REMATCH, () => {
    const room = roomManager.getRoomForSocket(socket);
    const slot = socket.data.slot;
    if (!room || !slot) return;
    room.voteRematch(slot);
  });

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket);
    broadcastOnlineCount();
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`NEON HOCKEY server listening on :${PORT}`);
});
