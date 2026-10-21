import { STATS_STORAGE_KEY } from './config';
import { readJSON, writeJSON } from './storage';

export interface Stats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

const EMPTY: Stats = { matchesPlayed: 0, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };

/** Stats are local to this browser only — there is no account system or
 * backend persistence, so this never claims to be a cross-device leaderboard. */
export function loadStats(): Stats {
  return readJSON<Stats>(STATS_STORAGE_KEY, EMPTY);
}

export function recordMatch(won: boolean, goalsFor: number, goalsAgainst: number): Stats {
  const current = loadStats();
  const next: Stats = {
    matchesPlayed: current.matchesPlayed + 1,
    wins: current.wins + (won ? 1 : 0),
    losses: current.losses + (won ? 0 : 1),
    goalsFor: current.goalsFor + goalsFor,
    goalsAgainst: current.goalsAgainst + goalsAgainst,
  };
  writeJSON(STATS_STORAGE_KEY, next);
  return next;
}
