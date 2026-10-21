import React, { useState } from 'react';
import type { PlayerSlotId, RoomSnapshot } from '@neon-hockey/shared';
import { NeonButton } from '../components/NeonButton';
import { ARENA_THEMES } from '../game/arenas';

const DUEL_SLOTS: PlayerSlotId[] = ['p1', 'p2'];
const DOUBLE_SLOTS: PlayerSlotId[] = ['p1', 'p2', 'p3', 'p4'];

export function Lobby({
  room,
  mySlot,
  onReady,
  onLeave,
}: {
  room: RoomSnapshot;
  mySlot: PlayerSlotId | null;
  onReady: (ready: boolean) => void;
  onLeave: () => void;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const slots = room.mode === 'duel' ? DUEL_SLOTS : DOUBLE_SLOTS;
  const theme = ARENA_THEMES[room.arena];
  const me = room.players.find((p) => p.slot === mySlot);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — non-critical, the code is already shown on screen
    }
  };

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 18 }}>
      <h2 className="section-title">Salle d'attente</h2>

      {!room.isPublic && (
        <div style={{ textAlign: 'center' }}>
          <div className="room-code">{room.roomCode}</div>
          <button className="link-btn" onClick={copyCode}>
            {copied ? 'Copié !' : 'Copier le code'}
          </button>
        </div>
      )}

      <div style={{ color: theme.railGlow, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', fontSize: '0.85rem' }}>
        ARÈNE : {theme.name}
      </div>

      <div className="seat-list">
        {slots.map((slot) => {
          const player = room.players.find((p) => p.slot === slot);
          if (!player) {
            return (
              <div key={slot} className="seat-row empty">
                <span className="pulse-dot" />
                <span>En attente d'un joueur…</span>
              </div>
            );
          }
          const color = player.team === 'cyan' ? theme.teamAColor : theme.teamBColor;
          return (
            <div key={slot} className="seat-row">
              <span className="seat-team-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              <span className="avatar-emoji">{player.avatar}</span>
              <span style={{ flex: 1 }}>{player.nickname}</span>
              {!player.connected && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>déconnecté</span>}
              {player.ready && <span style={{ color: '#3dffb0', fontSize: '0.75rem' }}>PRÊT</span>}
            </div>
          );
        })}
      </div>

      {!room.isPublic && me && (
        <NeonButton variant={me.ready ? 'ghost' : 'primary'} onClick={() => onReady(!me.ready)}>
          {me.ready ? 'Annuler prêt' : 'Je suis prêt'}
        </NeonButton>
      )}

      <NeonButton variant="ghost" onClick={onLeave}>
        Quitter le salon
      </NeonButton>
    </div>
  );
}
