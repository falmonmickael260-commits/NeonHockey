import React, { useEffect, useRef } from 'react';
import {
  MALLET_RADIUS,
  PUCK_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  clampMalletToZone,
  type GameStateSnapshot,
  type MalletState,
  type PlayerSlotId,
  type Team,
} from '@neon-hockey/shared';
import { useNetActions, useNetState } from '../net/NetworkContext';
import { GameRenderer } from './GameRenderer';
import { ARENA_THEMES, type ArenaTheme } from './arenas';
import { audioEngine } from '../audio/AudioEngine';
import { loadSettings } from '../settings';

interface SnapshotSample {
  snap: GameStateSnapshot;
  at: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function GameCanvas({ reduceEffects }: { reduceEffects: boolean }): React.ReactElement {
  const net = useNetState();
  const actions = useNetActions();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const bufferRef = useRef<SnapshotSample[]>([]);
  const localTargetRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const lastGoalNonceRef = useRef(0);
  const lastCountdownRef = useRef<number | null>(null);
  const hitCooldownRef = useRef<Map<string, number>>(new Map());
  const wallCooldownRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const myTeamRef = useRef<Team | null>(null);
  const mySlotRef = useRef<PlayerSlotId | null>(null);

  const mySlot = net.mySlot;
  const arenaId = net.room?.arena ?? 'cyber-blue';
  const theme = ARENA_THEMES[arenaId];

  useEffect(() => {
    mySlotRef.current = mySlot;
    const fromGame = net.game?.mallets.find((m) => m.playerId === mySlot)?.team;
    const fromRoom = net.room?.players.find((p) => p.slot === mySlot)?.team;
    myTeamRef.current = fromGame ?? fromRoom ?? myTeamRef.current;
  }, [mySlot, net.room, net.game]);

  // Push every new authoritative snapshot into a small interpolation buffer.
  useEffect(() => {
    if (!net.game) return;
    const buf = bufferRef.current;
    buf.push({ snap: net.game, at: performance.now() });
    if (buf.length > 2) buf.shift();

    // Keep the local target in sync the first time we see our own mallet,
    // so the predicted cursor doesn't snap from the spawn point.
    if (localTargetRef.current === null && mySlot) {
      const mine = net.game.mallets.find((m) => m.playerId === mySlot);
      if (mine) localTargetRef.current = { x: mine.x, y: mine.y };
    }
  }, [net.game, mySlot]);

  // Goal flash + sound, triggered once per new goal event.
  useEffect(() => {
    if (!net.lastGoal || net.lastGoal.nonce === lastGoalNonceRef.current) return;
    lastGoalNonceRef.current = net.lastGoal.nonce;
    rendererRef.current?.notifyGoal(net.lastGoal.scoringTeam);
    const theme2 = ARENA_THEMES[arenaId];
    rendererRef.current?.spawnHitSpark(
      TABLE_WIDTH / 2,
      net.lastGoal.scoringTeam === 'cyan' ? 0 : TABLE_HEIGHT,
      net.lastGoal.scoringTeam === 'cyan' ? theme2.teamAGlow : theme2.teamBGlow,
      1,
    );
    audioEngine.playGoal();
  }, [net.lastGoal, arenaId]);

  // Countdown beeps.
  useEffect(() => {
    const value = net.game?.countdownValue ?? null;
    if (value !== null && value !== lastCountdownRef.current) {
      audioEngine.playCountdownBeep(value === 0);
    }
    lastCountdownRef.current = value;
  }, [net.game?.countdownValue]);

  // Canvas sizing.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    rendererRef.current = new GameRenderer(canvas);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      rendererRef.current?.resize(rect.width, rect.height, dpr);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener('orientationchange', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
  }, []);

  // Pointer / touch input — mouse just hovers (pointermove fires continuously),
  // touch drags (pointermove only fires while the finger is down), so the same
  // handler naturally satisfies both control schemes from the brief.
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const updateTarget = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const table = renderer.screenToTable(clientX - rect.left, clientY - rect.top);
      const team = myTeamRef.current;
      if (!team) return;
      const fake: MalletState = {
        playerId: mySlotRef.current ?? 'p1',
        team,
        x: table.x,
        y: table.y,
        targetX: table.x,
        targetY: table.y,
        vx: 0,
        vy: 0,
      };
      clampMalletToZone(fake);
      if (!Number.isFinite(fake.x) || !Number.isFinite(fake.y)) return; // canvas not laid out yet (e.g. zero-size container)
      localTargetRef.current = { x: fake.x, y: fake.y };
      actions.sendInput(fake.x, fake.y);
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointerRef.current = e.pointerId;
      updateTarget(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && activePointerRef.current !== e.pointerId) return;
      e.preventDefault();
      updateTarget(e.clientX, e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (activePointerRef.current === e.pointerId) activePointerRef.current = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [actions]);

  // Main render loop.
  useEffect(() => {
    const settings = loadSettings();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      const renderer = rendererRef.current;
      if (renderer) {
        const buf = bufferRef.current;
        const { puck, mallets } = computeInterpolatedState(buf, now);

        const malletsRender = mallets.map((m) => ({
          x: m.playerId === mySlot && localTargetRef.current ? localTargetRef.current.x : m.x,
          y: m.playerId === mySlot && localTargetRef.current ? localTargetRef.current.y : m.y,
          team: m.team,
          isMine: m.playerId === mySlot,
        }));

        if (!settings.reduceEffects && !reduceEffects) {
          detectHitSparks(puck, mallets, mySlot, hitCooldownRef.current, now, renderer, theme);
          detectWallSparks(puck, wallCooldownRef, now, renderer, theme);
        }

        renderer.render({ puck, mallets: malletsRender, theme, reduceEffects: reduceEffects || settings.reduceEffects }, dt);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySlot, theme, reduceEffects]);

  return (
    <div ref={containerRef} className="game-canvas-container">
      <canvas ref={canvasRef} className="game-canvas" />
    </div>
  );
}

function computeInterpolatedState(
  buf: SnapshotSample[],
  now: number,
): { puck: { x: number; y: number }; mallets: MalletState[] } {
  if (buf.length === 0) {
    return { puck: { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2 }, mallets: [] };
  }
  if (buf.length === 1) {
    return { puck: buf[0].snap.puck, mallets: buf[0].snap.mallets };
  }
  const [prev, next] = buf;
  const span = next.at - prev.at;
  const t = span > 0 ? clamp((now - 90 - prev.at) / span, 0, 1.4) : 1;

  const puck = {
    x: lerp(prev.snap.puck.x, next.snap.puck.x, t),
    y: lerp(prev.snap.puck.y, next.snap.puck.y, t),
  };

  const mallets: MalletState[] = next.snap.mallets.map((n) => {
    const p = prev.snap.mallets.find((m) => m.playerId === n.playerId);
    if (!p) return n;
    return { ...n, x: lerp(p.x, n.x, t), y: lerp(p.y, n.y, t) };
  });

  return { puck, mallets };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function detectHitSparks(
  puck: { x: number; y: number },
  mallets: MalletState[],
  mySlot: PlayerSlotId | null,
  cooldowns: Map<string, number>,
  now: number,
  renderer: GameRenderer,
  theme: ArenaTheme,
): void {
  for (const m of mallets) {
    const dx = puck.x - m.x;
    const dy = puck.y - m.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const threshold = MALLET_RADIUS + PUCK_RADIUS + 4;
    const lastHit = cooldowns.get(m.playerId) ?? 0;
    if (dist < threshold && now - lastHit > 140) {
      cooldowns.set(m.playerId, now);
      const color = m.team === 'cyan' ? theme.teamAGlow : theme.teamBGlow;
      renderer.spawnHitSpark(puck.x, puck.y, color, 0.6);
      if (m.playerId === mySlot) audioEngine.playHit(0.7);
      else audioEngine.playHit(0.4);
    }
  }
}

function detectWallSparks(
  puck: { x: number; y: number },
  cooldownRef: { current: number },
  now: number,
  renderer: GameRenderer,
  theme: ArenaTheme,
): void {
  const margin = PUCK_RADIUS + 3;
  const nearWall =
    puck.x < margin || puck.x > TABLE_WIDTH - margin || puck.y < margin || puck.y > TABLE_HEIGHT - margin;
  if (nearWall && now - cooldownRef.current > 160) {
    cooldownRef.current = now;
    renderer.spawnHitSpark(puck.x, puck.y, theme.particleColor, 0.25);
    audioEngine.playWallBounce();
  }
}
