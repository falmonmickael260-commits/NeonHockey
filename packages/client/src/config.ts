export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ||
  `${window.location.protocol}//${window.location.hostname}:8787`;

export const AVATAR_CHOICES = ['🤖', '👾', '🚀', '⚡', '🎮', '🧊', '🔥', '🌌', '🛰️', '🎯'] as const;

export const PROFILE_STORAGE_KEY = 'neon-hockey-profile';
export const SESSION_STORAGE_KEY = 'neon-hockey-session';
export const STATS_STORAGE_KEY = 'neon-hockey-stats';
export const SETTINGS_STORAGE_KEY = 'neon-hockey-settings';
