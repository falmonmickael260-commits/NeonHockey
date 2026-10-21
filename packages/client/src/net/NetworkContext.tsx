import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type ArenaId,
  type GameMode,
  type GameStateSnapshot,
  type GoalEvent,
  type MatchResultPayload,
  type PlayerSlotId,
  type RoomSnapshot,
  type SeatedPayload,
} from '@neon-hockey/shared';
import { SERVER_URL, SESSION_STORAGE_KEY } from '../config';
import { clearKey, readJSON, writeJSON } from '../storage';

interface StoredSession {
  roomCode: string;
  token: string;
}

interface SearchingInfo {
  mode: GameMode;
  waiting: number;
  needed: number;
}

interface DisconnectBanner {
  slot: PlayerSlotId;
  nickname: string;
  timeoutSeconds: number;
}

interface RematchStatus {
  votes: number;
  needed: number;
}

export interface NetState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onlineCount: number;
  room: RoomSnapshot | null;
  mySlot: PlayerSlotId | null;
  game: GameStateSnapshot | null;
  lastGoal: (GoalEvent & { nonce: number }) | null;
  matchResult: MatchResultPayload | null;
  rematchStatus: RematchStatus | null;
  searching: SearchingInfo | null;
  disconnectBanner: DisconnectBanner | null;
  errorMessage: string | null;
}

type Action =
  | { type: 'connection'; status: NetState['connectionStatus'] }
  | { type: 'online_count'; count: number }
  | { type: 'seated'; payload: SeatedPayload }
  | { type: 'room_update'; room: RoomSnapshot }
  | { type: 'searching'; info: SearchingInfo | null }
  | { type: 'state'; game: GameStateSnapshot }
  | { type: 'goal'; goal: GoalEvent }
  | { type: 'match_result'; result: MatchResultPayload }
  | { type: 'rematch_status'; status: RematchStatus }
  | { type: 'opponent_disconnected'; banner: DisconnectBanner }
  | { type: 'opponent_reconnected' }
  | { type: 'error'; message: string }
  | { type: 'reset_for_menu' };

const initialState: NetState = {
  connectionStatus: 'connecting',
  onlineCount: 0,
  room: null,
  mySlot: null,
  game: null,
  lastGoal: null,
  matchResult: null,
  rematchStatus: null,
  searching: null,
  disconnectBanner: null,
  errorMessage: null,
};

let goalNonce = 0;

function reducer(state: NetState, action: Action): NetState {
  switch (action.type) {
    case 'connection':
      return { ...state, connectionStatus: action.status };
    case 'online_count':
      return { ...state, onlineCount: action.count };
    case 'seated':
      return { ...state, mySlot: action.payload.slot, searching: null, errorMessage: null };
    case 'room_update':
      return { ...state, room: action.room };
    case 'searching':
      return { ...state, searching: action.info };
    case 'state':
      // A fresh countdown means a rematch just started server-side — clear the
      // previous match's result/vote tally so the UI returns to gameplay.
      if (action.game.phase === 'countdown' && state.matchResult) {
        return { ...state, game: action.game, matchResult: null, rematchStatus: null };
      }
      return { ...state, game: action.game };
    case 'goal':
      return { ...state, lastGoal: { ...action.goal, nonce: ++goalNonce } };
    case 'match_result':
      return { ...state, matchResult: action.result };
    case 'rematch_status':
      return { ...state, rematchStatus: action.status };
    case 'opponent_disconnected':
      return { ...state, disconnectBanner: action.banner };
    case 'opponent_reconnected':
      return { ...state, disconnectBanner: null };
    case 'error':
      return { ...state, errorMessage: action.message };
    case 'reset_for_menu':
      return {
        ...initialState,
        connectionStatus: state.connectionStatus,
        onlineCount: state.onlineCount,
      };
    default:
      return state;
  }
}

export interface NetActions {
  quickMatch: (mode: GameMode, nickname: string, avatar: string) => void;
  cancelQuickMatch: () => void;
  createRoom: (opts: { mode: GameMode; arena: ArenaId; isPublic: boolean; nickname: string; avatar: string }) => void;
  joinRoom: (roomCode: string, nickname: string, avatar: string) => void;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  setArena: (arena: ArenaId) => void;
  sendInput: (x: number, y: number) => void;
  voteRematch: () => void;
  resetForMenu: () => void;
}

const StateContext = createContext<NetState>(initialState);
const ActionsContext = createContext<NetActions | null>(null);

export function useNetState(): NetState {
  return useContext(StateContext);
}

export function useNetActions(): NetActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useNetActions must be used within NetworkProvider');
  return ctx;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<Socket | null>(null);
  const inputSeqRef = useRef(0);
  const sessionRef = useRef<StoredSession | null>(readJSON<StoredSession | null>(SESSION_STORAGE_KEY, null));
  // A page refresh mid-match loses all in-memory React state but localStorage
  // survives — if a session was saved, assume it's worth one rejoin attempt.
  const wasSeatedRef = useRef(sessionRef.current !== null);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch({ type: 'connection', status: 'connected' });
      const stored = sessionRef.current;
      if (stored && wasSeatedRef.current) {
        socket.emit(SOCKET_EVENTS.REJOIN_ROOM, stored);
      }
    });
    socket.on('disconnect', () => dispatch({ type: 'connection', status: 'disconnected' }));
    socket.io.on('reconnect_attempt', () => dispatch({ type: 'connection', status: 'connecting' }));

    socket.on(SOCKET_EVENTS.ONLINE_COUNT, (p: { count: number }) => dispatch({ type: 'online_count', count: p.count }));

    socket.on(SOCKET_EVENTS.SEATED, (payload: SeatedPayload) => {
      wasSeatedRef.current = true;
      sessionRef.current = { roomCode: payload.roomCode, token: payload.token };
      writeJSON(SESSION_STORAGE_KEY, sessionRef.current);
      dispatch({ type: 'seated', payload });
    });

    socket.on(SOCKET_EVENTS.ROOM_UPDATE, (room: RoomSnapshot) => dispatch({ type: 'room_update', room }));
    socket.on(SOCKET_EVENTS.SEARCHING, (info: SearchingInfo) => dispatch({ type: 'searching', info }));
    socket.on(SOCKET_EVENTS.MATCH_FOUND, () => dispatch({ type: 'searching', info: null }));
    socket.on(SOCKET_EVENTS.STATE, (game: GameStateSnapshot) => dispatch({ type: 'state', game }));
    socket.on(SOCKET_EVENTS.GOAL, (goal: GoalEvent) => dispatch({ type: 'goal', goal }));
    socket.on(SOCKET_EVENTS.MATCH_RESULT, (result: MatchResultPayload) => {
      wasSeatedRef.current = false;
      clearKey(SESSION_STORAGE_KEY);
      dispatch({ type: 'match_result', result });
    });
    socket.on(SOCKET_EVENTS.REMATCH_STATUS, (status: RematchStatus) => dispatch({ type: 'rematch_status', status }));
    socket.on(SOCKET_EVENTS.OPPONENT_DISCONNECTED, (banner: DisconnectBanner) =>
      dispatch({ type: 'opponent_disconnected', banner }),
    );
    socket.on(SOCKET_EVENTS.OPPONENT_RECONNECTED, () => dispatch({ type: 'opponent_reconnected' }));
    socket.on(SOCKET_EVENTS.ERROR, (err: { code: string; message: string }) => {
      if (err.code === 'ROOM_NOT_FOUND') {
        // Stale session (server restarted, or the match already ended elsewhere) — stop retrying it.
        wasSeatedRef.current = false;
        sessionRef.current = null;
        clearKey(SESSION_STORAGE_KEY);
      }
      dispatch({ type: 'error', message: err.message });
    });

    return () => {
      socket.close();
    };
  }, []);

  const actions = useMemo<NetActions>(
    () => ({
      quickMatch: (mode, nickname, avatar) => socketRef.current?.emit(SOCKET_EVENTS.QUICK_MATCH, { mode, nickname, avatar }),
      cancelQuickMatch: () => socketRef.current?.emit(SOCKET_EVENTS.CANCEL_QUICK_MATCH),
      createRoom: (opts) => socketRef.current?.emit(SOCKET_EVENTS.CREATE_ROOM, opts),
      joinRoom: (roomCode, nickname, avatar) =>
        socketRef.current?.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, nickname, avatar }),
      leaveRoom: () => {
        socketRef.current?.emit(SOCKET_EVENTS.LEAVE_ROOM);
        wasSeatedRef.current = false;
        sessionRef.current = null;
        clearKey(SESSION_STORAGE_KEY);
        dispatch({ type: 'reset_for_menu' });
      },
      setReady: (ready) => socketRef.current?.emit(SOCKET_EVENTS.SET_READY, { ready }),
      setArena: (arena) => socketRef.current?.emit(SOCKET_EVENTS.SET_ARENA, { arena }),
      sendInput: (x, y) => {
        inputSeqRef.current += 1;
        socketRef.current?.emit(SOCKET_EVENTS.INPUT, { x, y, seq: inputSeqRef.current });
      },
      voteRematch: () => socketRef.current?.emit(SOCKET_EVENTS.VOTE_REMATCH),
      resetForMenu: () => dispatch({ type: 'reset_for_menu' }),
    }),
    [],
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}
