/**
 * What one play session is (a campaign level or a free-play board) and how its result is recorded.
 * Pure TS + the store — the screens call these so progress rules live in one place.
 */
import { CHAPTERS, LEVELS, levelBoard } from "./levels";
import {
  DAILY_TIERS, LOSS_LEAVES, MODES, dailySeed, leavesFor, newClassicGame, newGameFromBoard, starsFor, type ClassicMode, type GameState,
} from "./engine";
import { store } from "../modules/store";
import type { FieldTheme } from "../ui/Background";

export type Session =
  | { kind: "level"; level: number }
  | { kind: "free"; mode: ClassicMode; seed: number; daily?: 0 | 1 | 2; cozy?: boolean };

export const levelId = (n: number) => `L${n}`;
export const HINT_CAP = 3;
export const HINT_LEAVES = 15;
export const REVIVE_LEAVES = 80;

export function startState(s: Session): GameState {
  if (s.kind === "level") {
    const { board, open } = levelBoard(s.level - 1);
    return newGameFromBoard(board, open);
  }
  return newClassicGame(s.mode.w, s.mode.h, s.mode.pods, s.seed, !!s.cozy);
}

export function themeOf(s: Session): FieldTheme {
  if (s.kind === "level") return CHAPTERS[LEVELS[s.level - 1].chapter - 1].theme;
  const t = store.get().theme;
  return t === "garden" || t === "night" ? t : "paper";
}

export function dayKey(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
/** Calendar-day index of a yyyymmdd key (for streak gaps; tolerant to the time of day). */
function dayIndex(key: number): number {
  const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100, d = key % 100;
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function dailySession(tier: 0 | 1 | 2, date = new Date()): Session {
  return { kind: "free", mode: DAILY_TIERS[tier], seed: dailySeed(date, tier), daily: tier };
}
export function freeSession(modeId: string, cozy = false): Session {
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];
  return { kind: "free", mode, seed: (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0, cozy };
}

export const fmtTime = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export interface WinResult { stars?: number; leaves: number; best?: number; firstClear: boolean; note?: string }

/** Record a win; returns what the win card shows. */
export function recordWin(s: Session, g: GameState, secs: number): WinResult {
  const p = store.get();
  if (s.kind === "level") {
    const facts = levelBoard(s.level - 1).facts;
    const stars = starsFor(secs, facts.starTimes, g.usedUndo, g.hintsUsed);
    const id = levelId(s.level);
    const prev = p.stars ?? {};
    const firstClear = prev[id] === undefined;
    const leaves = leavesFor(stars, firstClear);
    store.set({
      stars: { ...prev, [id]: Math.max(prev[id] ?? 0, stars) },
      coins: p.coins + leaves,
      level: Math.max(p.level, s.level + 1),
    });
    const note = stars < 3
      ? g.usedUndo || g.hintsUsed ? "Clear it without undo or hints for 3 stars" : `3 stars under ${fmtTime(facts.starTimes[0])}`
      : undefined;
    return { stars, leaves, firstClear, note };
  }
  // Free play: +10 base + a small speed bonus; dailies +25; cozy boards are unranked.
  const bonus = Math.max(0, Math.min(10, Math.round((s.mode.w * s.mode.h * 0.9 - secs) / 8)));
  let leaves = 10 + bonus;
  const stats = { ...(p.modeStats ?? {}) };
  const key = s.cozy ? `${s.mode.id}-cozy` : s.mode.id;
  const cur = stats[key] ?? { plays: 0, wins: 0, streak: 0, bestStreak: 0 };
  const best = s.cozy ? cur.best : cur.best === undefined ? secs : Math.min(cur.best, secs);
  const streak = cur.streak + 1;
  stats[key] = { plays: cur.plays + 1, wins: cur.wins + 1, best, streak, bestStreak: Math.max(cur.bestStreak, streak) };
  const patch: Partial<typeof p> = { modeStats: stats };
  let note: string | undefined = s.cozy ? `Cozy board · ${g.mistakes} slip${g.mistakes === 1 ? "" : "s"} (unranked)` : streak > 1 ? `${streak} wins in a row` : undefined;
  if (s.daily !== undefined) {
    const today = dayKey();
    const daily = { ...(p.daily ?? {}) };
    const done = daily[today] ?? [];
    if (!done.includes(s.daily)) {
      leaves += 25;
      daily[today] = [...done, s.daily];
      patch.daily = daily;
      if (!done.length) {
        // First daily of the day extends the streak (a missed day resets it; same-day replays don't count).
        const last = p.lastDailyDay;
        const gap = last ? dayIndex(today) - dayIndex(last) : 99;
        patch.dailyStreak = gap === 1 ? (p.dailyStreak ?? 0) + 1 : gap === 0 ? p.dailyStreak ?? 1 : 1;
        patch.lastDailyDay = today;
      }
      note = `Daily cleared · ${patch.dailyStreak ?? p.dailyStreak ?? 1}-day streak`;
    }
  }
  patch.coins = p.coins + leaves;
  store.set(patch);
  return { leaves, best, firstClear: cur.wins === 0, note };
}

/** Record a loss (consolation leaves; free-play streak resets). */
export function recordLoss(s: Session): void {
  const p = store.get();
  const patch: Partial<typeof p> = { coins: p.coins + LOSS_LEAVES };
  if (s.kind === "free" && !s.cozy) {
    const stats = { ...(p.modeStats ?? {}) };
    const cur = stats[s.mode.id] ?? { plays: 0, wins: 0, streak: 0, bestStreak: 0 };
    stats[s.mode.id] = { ...cur, plays: cur.plays + 1, streak: 0 };
    patch.modeStats = stats;
  }
  store.set(patch);
}

/** Current daily streak, 0 if it lapsed (more than one day since the last daily). */
export function liveDailyStreak(): number {
  const p = store.get();
  if (!p.lastDailyDay) return 0;
  const gap = dayIndex(dayKey()) - dayIndex(p.lastDailyDay);
  return gap <= 1 ? p.dailyStreak ?? 0 : 0;
}
