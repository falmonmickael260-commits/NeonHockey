import { SETTINGS_STORAGE_KEY } from './config';
import { readJSON, writeJSON } from './storage';

export interface Settings {
  muted: boolean;
  volume: number; // 0..1
  reduceEffects: boolean;
}

const DEFAULTS: Settings = { muted: false, volume: 0.7, reduceEffects: false };

export function loadSettings(): Settings {
  return readJSON<Settings>(SETTINGS_STORAGE_KEY, DEFAULTS);
}

export function saveSettings(settings: Settings): void {
  writeJSON(SETTINGS_STORAGE_KEY, settings);
}
