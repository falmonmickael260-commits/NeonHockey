import React from 'react';
import { audioEngine } from '../audio/AudioEngine';

interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'magenta' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}

export function NeonButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  fullWidth,
  type = 'button',
}: NeonButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      className={`neon-btn ${variant} ${loading ? 'loading' : ''}`}
      style={fullWidth ? { width: '100%' } : undefined}
      disabled={disabled || loading}
      onMouseEnter={() => audioEngine.playUiHover()}
      onClick={() => {
        audioEngine.playUiClick();
        onClick?.();
      }}
    >
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}
