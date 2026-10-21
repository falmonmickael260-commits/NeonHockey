import React, { useState } from 'react';
import { NeonButton } from './NeonButton';
import { audioEngine } from '../audio/AudioEngine';
import { loadSettings, saveSettings, type Settings } from '../settings';

export function SettingsModal({
  onClose,
  onChange,
}: {
  onClose: () => void;
  onChange?: (settings: Settings) => void;
}): React.ReactElement {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const apply = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
    audioEngine.setMuted(next.muted);
    audioEngine.setVolume(next.volume);
    onChange?.(next);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel" style={{ width: 'min(360px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="section-title">Paramètres</h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span>Son</span>
          <NeonButton variant={settings.muted ? 'ghost' : 'primary'} onClick={() => apply({ ...settings, muted: !settings.muted })}>
            {settings.muted ? 'Muet' : 'Actif'}
          </NeonButton>
        </div>

        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-lo)', marginBottom: 6 }}>
          Volume
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(e) => apply({ ...settings, volume: Number(e.target.value) })}
          style={{ width: '100%', marginBottom: 18 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div>Effets réduits</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-lo)' }}>Particules, traînées et flous allégés</div>
          </div>
          <NeonButton
            variant={settings.reduceEffects ? 'primary' : 'ghost'}
            onClick={() => apply({ ...settings, reduceEffects: !settings.reduceEffects })}
          >
            {settings.reduceEffects ? 'Activé' : 'Désactivé'}
          </NeonButton>
        </div>

        <NeonButton fullWidth onClick={onClose}>
          Fermer
        </NeonButton>
      </div>
    </div>
  );
}
