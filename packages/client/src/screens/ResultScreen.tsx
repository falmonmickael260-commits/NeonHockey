import React, { useEffect, useRef } from 'react';
import type { MatchResultPayload, RoomSnapshot } from '@neon-hockey/shared';
import { NeonButton } from '../components/NeonButton';
import { recordMatch } from '../stats';

export function ResultScreen({
  result,
  room,
  myTeam,
  rematchStatus,
  onRematch,
  onLeave,
}: {
  result: MatchResultPayload;
  room: RoomSnapshot | null;
  myTeam: 'cyan' | 'magenta' | null;
  rematchStatus: { votes: number; needed: number } | null;
  onRematch: () => void;
  onLeave: () => void;
}): React.ReactElement {
  const recordedRef = useRef<string | null>(null);
  const won = myTeam ? result.winner === myTeam : false;
  const [durationS] = [Math.round(result.durationMs / 1000)];

  useEffect(() => {
    const key = `${result.roomCode}-${result.durationMs}`;
    if (recordedRef.current === key || !myTeam) return;
    recordedRef.current = key;
    const goalsFor = myTeam === 'cyan' ? result.score.cyan : result.score.magenta;
    const goalsAgainst = myTeam === 'cyan' ? result.score.magenta : result.score.cyan;
    recordMatch(won, goalsFor, goalsAgainst);
  }, [result, myTeam, won]);

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 18 }}>
      <h1 className={`result-title ${won ? 'win' : 'lose'}`}>{won ? 'VICTOIRE' : 'DÉFAITE'}</h1>

      <div className="panel" style={{ width: 'min(380px, 100%)' }}>
        <div className="stat-row">
          <span>Score final</span>
          <b>
            {result.score.cyan} — {result.score.magenta}
          </b>
        </div>
        <div className="stat-row">
          <span>Durée</span>
          <b>
            {Math.floor(durationS / 60)}m {durationS % 60}s
          </b>
        </div>
        {room && (
          <div className="stat-row" style={{ border: 'none' }}>
            <span>Arène</span>
            <b>{room.arena}</b>
          </div>
        )}
      </div>

      <div className="menu-row" style={{ width: 'min(380px, 100%)' }}>
        <NeonButton variant="ghost" onClick={onLeave}>
          Retour au menu
        </NeonButton>
        <NeonButton variant="primary" onClick={onRematch}>
          Revanche {rematchStatus ? `(${rematchStatus.votes}/${rematchStatus.needed})` : ''}
        </NeonButton>
      </div>
    </div>
  );
}
