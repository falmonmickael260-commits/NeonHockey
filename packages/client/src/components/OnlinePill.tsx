import React from 'react';
import { useNetState } from '../net/NetworkContext';

export function OnlinePill(): React.ReactElement {
  const net = useNetState();
  return (
    <div className="online-pill">
      <span className="online-dot" />
      {net.connectionStatus === 'connected' ? `${net.onlineCount} en ligne` : 'Connexion…'}
    </div>
  );
}
