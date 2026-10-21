import React from 'react';
import type { GameMode } from '@neon-hockey/shared';
import { NeonButton } from '../components/NeonButton';

interface SearchingInfo {
  mode: GameMode;
  waiting: number;
  needed: number;
}

export function ModeSelect({
  mode,
  onChooseMode,
  onBack,
  onQuickMatch,
  onCreate,
  onJoin,
  searching,
  onCancelSearch,
}: {
  mode: GameMode | null;
  onChooseMode: (m: GameMode) => void;
  onBack: () => void;
  onQuickMatch: () => void;
  onCreate: () => void;
  onJoin: () => void;
  searching: SearchingInfo | null;
  onCancelSearch: () => void;
}): React.ReactElement {
  if (!mode) {
    return (
      <div className="screen" style={{ justifyContent: 'center', gap: 24 }}>
        <h2 className="section-title">Choisis un mode</h2>
        <div className="menu-row" style={{ width: 'min(520px, 100%)' }}>
          <button className="arena-card panel" onClick={() => onChooseMode('duel')}>
            <div className="arena-name">DUEL — 1 vs 1</div>
            <div className="arena-tagline">Un adversaire, un but chacun</div>
          </button>
          <button className="arena-card panel" onClick={() => onChooseMode('double')}>
            <div className="arena-name">DOUBLE — 2 vs 2</div>
            <div className="arena-tagline">Équipe cyan contre équipe magenta</div>
          </button>
        </div>
        <NeonButton variant="ghost" onClick={onBack}>
          Retour
        </NeonButton>
      </div>
    );
  }

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 20 }}>
      <h2 className="section-title">{mode === 'duel' ? 'DUEL — 1 vs 1' : 'DOUBLE — 2 vs 2'}</h2>

      {searching ? (
        <div className="panel" style={{ textAlign: 'center', width: 'min(360px, 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
            <span className="pulse-dot" />
            <span className="pulse-dot" style={{ animationDelay: '0.2s' }} />
            <span className="pulse-dot" style={{ animationDelay: '0.4s' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
            RECHERCHE D'ADVERSAIRE…
          </div>
          <div style={{ color: 'var(--text-lo)', fontSize: '0.85rem', marginTop: 6 }}>
            {searching.waiting} / {searching.needed} joueurs
          </div>
          <div style={{ height: 16 }} />
          <NeonButton variant="ghost" onClick={onCancelSearch}>
            Annuler
          </NeonButton>
        </div>
      ) : (
        <div className="menu-grid">
          <NeonButton variant="primary" fullWidth onClick={onQuickMatch}>
            Recherche rapide
          </NeonButton>
          <NeonButton variant="ghost" fullWidth onClick={onCreate}>
            Créer un salon
          </NeonButton>
          <NeonButton variant="ghost" fullWidth onClick={onJoin}>
            Rejoindre un salon
          </NeonButton>
          <NeonButton variant="ghost" fullWidth onClick={onBack}>
            Retour
          </NeonButton>
        </div>
      )}
    </div>
  );
}
