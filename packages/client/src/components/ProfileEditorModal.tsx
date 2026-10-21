import React, { useState } from 'react';
import { AVATAR_CHOICES } from '../config';
import type { Profile } from '../profile';
import { NeonButton } from './NeonButton';

export function ProfileEditorModal({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onClose: () => void;
}): React.ReactElement {
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatar, setAvatar] = useState(profile.avatar);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel" style={{ width: 'min(360px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="section-title">Profil</h3>
        <input
          className="input-field"
          value={nickname}
          maxLength={16}
          placeholder="Pseudonyme"
          onChange={(e) => setNickname(e.target.value)}
        />
        <div style={{ height: 14 }} />
        <div className="avatar-pick">
          {AVATAR_CHOICES.map((a) => (
            <button
              key={a}
              className={a === avatar ? 'selected' : ''}
              onClick={() => setAvatar(a)}
              type="button"
            >
              {a}
            </button>
          ))}
        </div>
        <div style={{ height: 18 }} />
        <div className="menu-row">
          <NeonButton variant="ghost" onClick={onClose}>
            Annuler
          </NeonButton>
          <NeonButton
            onClick={() => {
              onSave({ nickname: nickname.trim() || profile.nickname, avatar });
              onClose();
            }}
          >
            Enregistrer
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
