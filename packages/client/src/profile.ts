import { AVATAR_CHOICES, PROFILE_STORAGE_KEY } from './config';
import { readJSON, writeJSON } from './storage';

export interface Profile {
  nickname: string;
  avatar: string;
}

function randomNickname(): string {
  return `Joueur${Math.floor(1000 + Math.random() * 9000)}`;
}

export function loadProfile(): Profile {
  const existing = readJSON<Profile | null>(PROFILE_STORAGE_KEY, null);
  if (existing) return existing;

  // First visit — mint a random identity and persist it immediately so a
  // reload doesn't silently hand the player a different name mid-session.
  const fresh: Profile = {
    nickname: randomNickname(),
    avatar: AVATAR_CHOICES[Math.floor(Math.random() * AVATAR_CHOICES.length)],
  };
  writeJSON(PROFILE_STORAGE_KEY, fresh);
  return fresh;
}

export function saveProfile(profile: Profile): void {
  writeJSON(PROFILE_STORAGE_KEY, profile);
}
