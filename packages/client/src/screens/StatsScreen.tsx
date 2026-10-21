import React from 'react';
import { NeonButton } from '../components/NeonButton';
import { loadStats } from '../stats';

export function StatsScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const stats = loadStats();
  const winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 18 }}>
      <h2 className="section-title">Statistiques (locales à cet appareil)</h2>
      <div className="panel" style={{ width: 'min(380px, 100%)' }}>
        <div className="stat-row">
          <span>Parties jouées</span>
          <b>{stats.matchesPlayed}</b>
        </div>
        <div className="stat-row">
          <span>Victoires</span>
          <b>{stats.wins}</b>
        </div>
        <div className="stat-row">
          <span>Défaites</span>
          <b>{stats.losses}</b>
        </div>
        <div className="stat-row">
          <span>Taux de victoire</span>
          <b>{winRate}%</b>
        </div>
        <div className="stat-row">
          <span>Buts marqués</span>
          <b>{stats.goalsFor}</b>
        </div>
        <div className="stat-row" style={{ border: 'none' }}>
          <span>Buts concédés</span>
          <b>{stats.goalsAgainst}</b>
        </div>
      </div>
      <NeonButton variant="ghost" onClick={onBack}>
        Retour
      </NeonButton>
    </div>
  );
}
