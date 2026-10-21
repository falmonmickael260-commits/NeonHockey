import React, { useEffect, useState } from 'react';
import type { RoomSnapshot } from '@neon-hockey/shared';
import { useNetState } from '../net/NetworkContext';
import { GameCanvas } from '../game/GameCanvas';
import { ARENA_THEMES } from '../game/arenas';
import { NeonButton } from '../components/NeonButton';
import { SettingsModal } from '../components/SettingsModal';
import { loadSettings } from '../settings';

/** Suggests landscape on small, non-landscape phone screens — discreet, never
 * blocks play, and disappears automatically once the device is rotated. */
function useOrientationHint(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => {
      const minSide = Math.min(window.innerWidth, window.innerHeight);
      const isSmallPhone = minSide > 0 && minSide < 500;
      const isLandscape = window.innerWidth > window.innerHeight;
      setShow(isSmallPhone && !isLandscape);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return show;
}

function teamNames(room: RoomSnapshot | null, team: 'cyan' | 'magenta'): string {
  if (!room) return '';
  return room.players
    .filter((p) => p.team === team)
    .map((p) => p.nickname)
    .join(' & ');
}

export function MatchScreen({ onLeave }: { onLeave: () => void }): React.ReactElement {
  const net = useNetState();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reduceEffects, setReduceEffects] = useState(() => loadSettings().reduceEffects);
  const [bump, setBump] = useState<'cyan' | 'magenta' | null>(null);
  const showOrientationHint = useOrientationHint();

  const score = net.game?.score ?? { cyan: 0, magenta: 0 };
  const theme = ARENA_THEMES[net.room?.arena ?? 'cyber-blue'];
  const countdownValue = net.game?.countdownValue ?? null;

  useEffect(() => {
    if (!net.lastGoal) return;
    setBump(net.lastGoal.scoringTeam);
    const t = setTimeout(() => setBump(null), 320);
    return () => clearTimeout(t);
  }, [net.lastGoal?.nonce]);

  return (
    <div className="match-screen">
      <div className="match-hud-top">
        <div className={`score-chip cyan`} style={{ borderColor: theme.teamAColor }}>
          <span>{teamNames(net.room, 'cyan') || 'Équipe Cyan'}</span>
          <span className={`score-value ${bump === 'cyan' ? 'bump' : ''}`}>{score.cyan}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NeonButton variant="ghost" onClick={() => setShowSettings(true)}>
            ⚙
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => setConfirmQuit(true)}>
            Quitter
          </NeonButton>
        </div>
        <div className={`score-chip magenta`} style={{ borderColor: theme.teamBColor }}>
          <span className={`score-value ${bump === 'magenta' ? 'bump' : ''}`}>{score.magenta}</span>
          <span>{teamNames(net.room, 'magenta') || 'Équipe Magenta'}</span>
        </div>
      </div>

      <GameCanvas reduceEffects={reduceEffects} />

      {countdownValue !== null && (
        <div className="countdown-overlay">
          <div key={countdownValue} className="countdown-number">
            {countdownValue === 0 ? 'GO !' : countdownValue}
          </div>
        </div>
      )}

      {net.disconnectBanner && (
        <div className="banner">
          <span className="pulse-dot" />
          {net.disconnectBanner.nickname} s'est déconnecté — reconnexion possible pendant{' '}
          {net.disconnectBanner.timeoutSeconds}s…
        </div>
      )}

      {showOrientationHint && <div className="orientation-hint">Passe en mode paysage pour une meilleure expérience</div>}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onChange={(s) => setReduceEffects(s.reduceEffects)} />
      )}

      {confirmQuit && (
        <div className="modal-backdrop" onClick={() => setConfirmQuit(false)}>
          <div className="panel" style={{ width: 'min(340px, 100%)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <p>Quitter la partie en cours ?</p>
            <div className="menu-row">
              <NeonButton variant="ghost" onClick={() => setConfirmQuit(false)}>
                Annuler
              </NeonButton>
              <NeonButton variant="magenta" onClick={onLeave}>
                Quitter
              </NeonButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
