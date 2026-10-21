import React, { useState } from 'react';
import { NeonButton } from '../components/NeonButton';
import { OnlinePill } from '../components/OnlinePill';
import { ProfileEditorModal } from '../components/ProfileEditorModal';
import type { Profile } from '../profile';
import type { GameMode } from '@neon-hockey/shared';

export function MainMenu({
  profile,
  onSaveProfile,
  onPlay,
  onPickMode,
  onJoin,
  onArenaSelect,
  onStats,
}: {
  profile: Profile;
  onSaveProfile: (p: Profile) => void;
  onPlay: () => void;
  onPickMode: (mode: GameMode) => void;
  onJoin: () => void;
  onArenaSelect: () => void;
  onStats: () => void;
}): React.ReactElement {
  const [editingProfile, setEditingProfile] = useState(false);

  return (
    <div className="screen" style={{ justifyContent: 'space-between' }}>
      <div className="topbar">
        <button className="profile-badge" onClick={() => setEditingProfile(true)}>
          <span className="avatar-emoji">{profile.avatar}</span>
          <span>{profile.nickname}</span>
        </button>
        <OnlinePill />
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 className="logo-title">NEON HOCKEY</h1>
        <div className="logo-subtitle">Arcade futuriste — multijoueur en ligne</div>
      </div>

      <div className="menu-grid">
        <NeonButton variant="primary" fullWidth onClick={onPlay}>
          Jouer
        </NeonButton>
        <div className="menu-row">
          <NeonButton variant="ghost" onClick={() => onPickMode('duel')}>
            Duel 1 vs 1
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => onPickMode('double')}>
            Double 2 vs 2
          </NeonButton>
        </div>
        <NeonButton variant="ghost" fullWidth onClick={onJoin}>
          Rejoindre un salon
        </NeonButton>
        <div className="menu-row">
          <NeonButton variant="ghost" onClick={onArenaSelect}>
            Choisir une arène
          </NeonButton>
          <NeonButton variant="ghost" onClick={onStats}>
            Statistiques
          </NeonButton>
        </div>
      </div>

      <div style={{ height: 4 }} />

      {editingProfile && (
        <ProfileEditorModal profile={profile} onSave={onSaveProfile} onClose={() => setEditingProfile(false)} />
      )}
    </div>
  );
}
