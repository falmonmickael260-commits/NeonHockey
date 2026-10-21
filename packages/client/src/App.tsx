import React, { useEffect, useState } from 'react';
import type { ArenaId, GameMode } from '@neon-hockey/shared';
import { NetworkProvider, useNetActions, useNetState } from './net/NetworkContext';
import { MainMenu } from './screens/MainMenu';
import { ModeSelect } from './screens/ModeSelect';
import { ArenaSelect } from './screens/ArenaSelect';
import { JoinScreen } from './screens/JoinScreen';
import { Lobby } from './screens/Lobby';
import { MatchScreen } from './screens/MatchScreen';
import { ResultScreen } from './screens/ResultScreen';
import { StatsScreen } from './screens/StatsScreen';
import { loadProfile, saveProfile, type Profile } from './profile';
import { audioEngine } from './audio/AudioEngine';
import { loadSettings } from './settings';

type Screen = 'menu' | 'mode-select' | 'arena-select' | 'join' | 'lobby' | 'match' | 'result' | 'stats';

function Shell(): React.ReactElement | null {
  const net = useNetState();
  const actions = useNetActions();

  const [screen, setScreen] = useState<Screen>('menu');
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedArena, setSelectedArena] = useState<ArenaId>('cyber-blue');
  const [arenaFlowIsCreate, setArenaFlowIsCreate] = useState(false);

  // Unlock audio on the very first user gesture (browser autoplay policy).
  useEffect(() => {
    const unlock = () => {
      audioEngine.unlock();
      const settings = loadSettings();
      audioEngine.setMuted(settings.muted);
      audioEngine.setVolume(settings.volume);
      audioEngine.startAmbience();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Auto-navigate based on authoritative server state.
  useEffect(() => {
    if (net.room && ['menu', 'mode-select', 'arena-select', 'join'].includes(screen)) {
      setScreen('lobby');
    }
  }, [net.room, screen]);

  useEffect(() => {
    if (!net.room) return;
    const phase = net.game?.phase ?? net.room.phase;
    // Stay on the result screen while a finished match's result is still the
    // current one — but once a rematch clears it (phase flips back to
    // 'countdown' in the same update), fall through and return to the table.
    const showingThisResult = screen === 'result' && net.matchResult !== null;
    if (['countdown', 'playing', 'goal-pause'].includes(phase) && screen !== 'match' && !showingThisResult) {
      setScreen('match');
    }
  }, [net.room, net.game?.phase, net.matchResult, screen]);

  useEffect(() => {
    if (net.matchResult) setScreen('result');
  }, [net.matchResult]);

  const saveProfileAndClose = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
  };

  const goMenu = () => {
    setSelectedMode(null);
    setScreen('menu');
  };

  const leaveToMenu = () => {
    actions.leaveRoom();
    goMenu();
  };

  const myTeam = net.room?.players.find((p) => p.slot === net.mySlot)?.team ?? null;

  switch (screen) {
    case 'menu':
      return (
        <MainMenu
          profile={profile}
          onSaveProfile={saveProfileAndClose}
          onPlay={() => {
            setSelectedMode(null);
            setScreen('mode-select');
          }}
          onPickMode={(mode) => {
            setSelectedMode(mode);
            setScreen('mode-select');
          }}
          onJoin={() => setScreen('join')}
          onArenaSelect={() => {
            setArenaFlowIsCreate(false);
            setScreen('arena-select');
          }}
          onStats={() => setScreen('stats')}
        />
      );

    case 'mode-select':
      return (
        <ModeSelect
          mode={selectedMode}
          onChooseMode={setSelectedMode}
          onBack={() => {
            if (selectedMode) setSelectedMode(null);
            else setScreen('menu');
          }}
          onQuickMatch={() => selectedMode && actions.quickMatch(selectedMode, profile.nickname, profile.avatar)}
          onCreate={() => {
            setArenaFlowIsCreate(true);
            setScreen('arena-select');
          }}
          onJoin={() => setScreen('join')}
          searching={net.searching}
          onCancelSearch={() => actions.cancelQuickMatch()}
        />
      );

    case 'arena-select':
      return (
        <ArenaSelect
          selected={selectedArena}
          onSelect={setSelectedArena}
          onBack={() => setScreen(arenaFlowIsCreate ? 'mode-select' : 'menu')}
          confirmLabel={arenaFlowIsCreate ? 'Créer le salon' : undefined}
          onConfirm={
            arenaFlowIsCreate && selectedMode
              ? () =>
                  actions.createRoom({
                    mode: selectedMode,
                    arena: selectedArena,
                    isPublic: false,
                    nickname: profile.nickname,
                    avatar: profile.avatar,
                  })
              : undefined
          }
        />
      );

    case 'join':
      return (
        <JoinScreen
          onJoin={(code) => actions.joinRoom(code, profile.nickname, profile.avatar)}
          onBack={() => setScreen(selectedMode ? 'mode-select' : 'menu')}
          errorMessage={net.errorMessage}
        />
      );

    case 'lobby':
      return net.room ? (
        <Lobby room={net.room} mySlot={net.mySlot} onReady={actions.setReady} onLeave={leaveToMenu} />
      ) : (
        <MainMenu
          profile={profile}
          onSaveProfile={saveProfileAndClose}
          onPlay={() => setScreen('mode-select')}
          onPickMode={(mode) => {
            setSelectedMode(mode);
            setScreen('mode-select');
          }}
          onJoin={() => setScreen('join')}
          onArenaSelect={() => setScreen('arena-select')}
          onStats={() => setScreen('stats')}
        />
      );

    case 'match':
      return <MatchScreen onLeave={leaveToMenu} />;

    case 'result':
      return net.matchResult ? (
        <ResultScreen
          result={net.matchResult}
          room={net.room}
          myTeam={myTeam}
          rematchStatus={net.rematchStatus}
          onRematch={() => actions.voteRematch()}
          onLeave={leaveToMenu}
        />
      ) : null;

    case 'stats':
      return <StatsScreen onBack={goMenu} />;

    default:
      return null;
  }
}

export default function App(): React.ReactElement {
  return (
    <NetworkProvider>
      <div className="app-root">
        <div className="bg-grid" />
        <Shell />
      </div>
    </NetworkProvider>
  );
}
