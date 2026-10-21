import type { ArenaId } from '@neon-hockey/shared';

export interface ArenaTheme {
  id: ArenaId;
  name: string;
  tagline: string;
  /** Deep background gradient, center → edge. Physics never reads this —
   * only the renderer does, which is what keeps every arena fair. */
  bgInner: string;
  bgOuter: string;
  railColor: string;
  railGlow: string;
  surfaceGrid: string;
  centerLine: string;
  centerGlow: string;
  particleColor: string;
  // Team A is always the logical "cyan" team server-side, Team B is "magenta" —
  // only the display color changes per arena, never which half a team defends.
  teamAColor: string;
  teamAGlow: string;
  teamBColor: string;
  teamBGlow: string;
  puckColor: string;
  puckGlow: string;
}

export const ARENA_THEMES: Record<ArenaId, ArenaTheme> = {
  'cyber-blue': {
    id: 'cyber-blue',
    name: 'CYBER BLUE',
    tagline: 'Technologique & minimaliste',
    bgInner: '#0b1530',
    bgOuter: '#03050f',
    railColor: '#0c2a4d',
    railGlow: '#2fd8ff',
    surfaceGrid: 'rgba(60, 170, 255, 0.07)',
    centerLine: 'rgba(80, 200, 255, 0.55)',
    centerGlow: '#39d8ff',
    particleColor: '#6fe3ff',
    teamAColor: '#2fe3ff',
    teamAGlow: '#8af6ff',
    teamBColor: '#ff3fd1',
    teamBGlow: '#ff9bec',
    puckColor: '#f3fbff',
    puckGlow: '#9fe9ff',
  },
  'neon-pulse': {
    id: 'neon-pulse',
    name: 'NEON PULSE',
    tagline: 'Arcade nocturne',
    bgInner: '#1a0b33',
    bgOuter: '#050211',
    railColor: '#2d0f4d',
    railGlow: '#c33bff',
    surfaceGrid: 'rgba(200, 80, 255, 0.07)',
    centerLine: 'rgba(255, 110, 230, 0.55)',
    centerGlow: '#d84bff',
    particleColor: '#e46bff',
    teamAColor: '#4fd1ff',
    teamAGlow: '#9df0ff',
    teamBColor: '#ff46d6',
    teamBGlow: '#ffa0ec',
    puckColor: '#fbf1ff',
    puckGlow: '#e3b6ff',
  },
  reactor: {
    id: 'reactor',
    name: 'REACTOR',
    tagline: 'Cœur en fusion',
    bgInner: '#06281f',
    bgOuter: '#02100c',
    railColor: '#0e3a2b',
    railGlow: '#39ff9d',
    surfaceGrid: 'rgba(60, 255, 170, 0.07)',
    centerLine: 'rgba(90, 255, 190, 0.55)',
    centerGlow: '#49ffb0',
    particleColor: '#7bffce',
    teamAColor: '#39ff9d',
    teamAGlow: '#aaffda',
    teamBColor: '#2fd0ff',
    teamBGlow: '#a0f0ff',
    puckColor: '#f1fff6',
    puckGlow: '#b6ffd9',
  },
  'solar-flare': {
    id: 'solar-flare',
    name: 'SOLAR FLARE',
    tagline: 'Énergie thermique',
    bgInner: '#2a0f05',
    bgOuter: '#0e0502',
    railColor: '#4a1a07',
    railGlow: '#ff8a1f',
    surfaceGrid: 'rgba(255, 150, 60, 0.08)',
    centerLine: 'rgba(255, 190, 110, 0.55)',
    centerGlow: '#ffb347',
    particleColor: '#ffcf8a',
    teamAColor: '#ffb020',
    teamAGlow: '#ffe3a0',
    teamBColor: '#ff3b3b',
    teamBGlow: '#ff9a9a',
    puckColor: '#fff6ea',
    puckGlow: '#ffd9a0',
  },
  galaxy: {
    id: 'galaxy',
    name: 'GALAXY',
    tagline: 'Halo cosmique',
    bgInner: '#120a33',
    bgOuter: '#030212',
    railColor: '#1c1250',
    railGlow: '#8a6bff',
    surfaceGrid: 'rgba(140, 120, 255, 0.07)',
    centerLine: 'rgba(170, 150, 255, 0.5)',
    centerGlow: '#9d8bff',
    particleColor: '#c9bdff',
    teamAColor: '#5ad1ff',
    teamAGlow: '#b6ecff',
    teamBColor: '#b06bff',
    teamBGlow: '#e0c3ff',
    puckColor: '#f5f2ff',
    puckGlow: '#d2c6ff',
  },
};

export const ARENA_LIST = Object.values(ARENA_THEMES);
