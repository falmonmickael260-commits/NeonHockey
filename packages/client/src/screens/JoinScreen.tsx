import React, { useState } from 'react';
import { NeonButton } from '../components/NeonButton';

export function JoinScreen({
  onJoin,
  onBack,
  errorMessage,
}: {
  onJoin: (code: string) => void;
  onBack: () => void;
  errorMessage: string | null;
}): React.ReactElement {
  const [code, setCode] = useState('');

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 20 }}>
      <h2 className="section-title">Rejoindre un salon</h2>
      <div className="panel" style={{ width: 'min(360px, 100%)' }}>
        <input
          className="input-field"
          style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
          value={code}
          maxLength={6}
          placeholder="CODE"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.trim()) onJoin(code.trim());
          }}
        />
        {errorMessage && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>{errorMessage}</div>}
        <div style={{ height: 16 }} />
        <div className="menu-row">
          <NeonButton variant="ghost" onClick={onBack}>
            Retour
          </NeonButton>
          <NeonButton variant="primary" disabled={!code.trim()} onClick={() => onJoin(code.trim())}>
            Rejoindre
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
