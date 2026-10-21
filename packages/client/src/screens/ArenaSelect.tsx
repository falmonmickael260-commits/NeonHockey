import React from 'react';
import type { ArenaId } from '@neon-hockey/shared';
import { ARENA_LIST } from '../game/arenas';
import { NeonButton } from '../components/NeonButton';

export function ArenaSelect({
  selected,
  onSelect,
  onBack,
  confirmLabel,
  onConfirm,
}: {
  selected: ArenaId;
  onSelect: (a: ArenaId) => void;
  onBack: () => void;
  confirmLabel?: string;
  onConfirm?: () => void;
}): React.ReactElement {
  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 22 }}>
      <h2 className="section-title">Choisis une arène</h2>
      <div className="arena-grid">
        {ARENA_LIST.map((theme) => (
          <button
            key={theme.id}
            className={`arena-card ${selected === theme.id ? 'selected' : ''}`}
            style={{
              background: `radial-gradient(circle at 50% 110%, ${theme.bgInner}, ${theme.bgOuter})`,
              boxShadow: selected === theme.id ? `0 0 26px ${theme.railGlow}55` : 'none',
            }}
            onClick={() => onSelect(theme.id)}
          >
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                display: 'flex',
                gap: 6,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.teamAColor, boxShadow: `0 0 8px ${theme.teamAGlow}` }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.teamBColor, boxShadow: `0 0 8px ${theme.teamBGlow}` }} />
            </div>
            <div className="arena-name" style={{ color: theme.railGlow }}>
              {theme.name}
            </div>
            <div className="arena-tagline">{theme.tagline}</div>
          </button>
        ))}
      </div>
      <div className="menu-row" style={{ width: 'min(420px, 100%)' }}>
        <NeonButton variant="ghost" onClick={onBack}>
          Retour
        </NeonButton>
        {onConfirm && (
          <NeonButton variant="primary" onClick={onConfirm}>
            {confirmLabel ?? 'Valider'}
          </NeonButton>
        )}
      </div>
    </div>
  );
}
