import { randomBytes } from 'node:crypto';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

export function generateRoomCode(length = 5): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export function sanitizeNickname(raw: string): string {
  const trimmed = (raw ?? '').toString().trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : 'Joueur';
}

export function sanitizeAvatar(raw: string): string {
  const trimmed = (raw ?? '').toString().trim().slice(0, 8);
  return trimmed.length > 0 ? trimmed : '🙂';
}
