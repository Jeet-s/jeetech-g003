import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { LevelsScreen } from "./screens/LevelsScreen";
import { GameScreen } from "./screens/GameScreen";
import { FreePlayScreen } from "./screens/FreePlayScreen";
import { LEVELS } from "./game/levels";
import { dailySession, dayKey, freeSession, levelId } from "./game/session";
import { store } from "./modules/store";

/**
 * Screenshot mode: the factory opens the app with <scheme>://shot/<id> on an emulator and captures the
 * screen for the Play Store listing. Every scene renders the REAL screens in a real state (a level
 * mid-solve from its own solver trace, a finished level with its win card, the map with progress).
 */
const noop = () => {};

export function ScreenshotScene({ id }: { id: string }) {
  // A player well into chapter 3 (stars, leaves, a daily streak) — not an empty profile.
  useState(() => {
    const stars: Record<string, number> = {};
    LEVELS.slice(0, 13).forEach((l, i) => (stars[levelId(l.number)] = i % 5 === 3 ? 2 : 3));
    store.set({
      level: 14, coins: 1240, stars, tutorialDone: true, theme: "paper", ownedThemes: ["paper", "garden"],
      dailyStreak: 6, lastDailyDay: dayKey(), daily: { [dayKey()]: [0] },
      modeStats: { beginner: { plays: 14, wins: 12, best: 41, streak: 5, bestStreak: 7 }, classic: { plays: 6, wins: 4, best: 118, streak: 2, bestStreak: 3 } },
    });
    return true;
  });
  const game = (level: number, steps: number, win?: boolean, secs = 48) => (
    <GameScreen session={{ kind: "level", level }} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ steps, win, secs }} />
  );
  switch (id) {
    case "solve":
      return game(9, 2, false, 37);
    case "win":
      return game(12, 999, true, 74);
    case "night":
      return game(30, 3, false, 96);
    // QA render checks (not store scenes): the tutorial board as a player first sees it, a mid-solve Expert
    // board, and a level finished live so the full win celebration plays.
    case "level1":
      return game(1, 0, false, 5);
    case "expert":
      return <GameScreen session={freeSession("expert")} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ steps: 3, secs: 64 }} />;
    case "celebrate":
      return <GameScreen session={{ kind: "level", level: 6 }} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ steps: 2, win: true, secs: 41, live: true }} />;
    case "map":
      return <LevelsScreen onPlay={noop} onBack={noop} />;
    case "daily":
      return <GameScreen session={dailySession(1)} onExit={noop} onSettings={noop} onNextLevel={noop} demo={{ steps: 2, secs: 52 }} />;
    case "freeplay":
      return (
        <>
          <HomeScreen onPlay={noop} onLevels={noop} onFreePlay={noop} onShop={noop} onSettings={noop} />
          <FreePlayScreen visible onClose={noop} onStart={noop} />
        </>
      );
    case "home":
    default:
      return <HomeScreen onPlay={noop} onLevels={noop} onFreePlay={noop} onShop={noop} onSettings={noop} />;
  }
}
