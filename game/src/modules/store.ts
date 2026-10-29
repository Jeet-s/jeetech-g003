import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny persisted player state (entitlements + currency). Loaded once at boot;
 * reads are synchronous afterwards so gameplay code stays simple.
 */
export interface PlayerState {
  adsRemoved: boolean;
  coins: number;
  level: number;
  /** Settings — default on. */
  sound?: boolean;
  music?: boolean;
  haptics?: boolean;
  /** Best stars per level id (progress map). */
  stars?: Record<string, number>;
  tutorialDone?: boolean;
  /** Controls & accessibility. */
  holdMs?: number; // long-press-to-flag duration (200–800)
  bigCells?: boolean;
  leftHanded?: boolean;
  colorblind?: boolean; // shape pips under every number
  /** Cosmetic field themes (bought with leaves). */
  theme?: string;
  ownedThemes?: string[];
  /** Free-play records per mode id. */
  modeStats?: Record<string, { plays: number; wins: number; best?: number; streak: number; bestStreak: number }>;
  /** Daily boards: tiers cleared per local day key (yyyymmdd) and the day streak. */
  daily?: Record<string, number[]>;
  dailyStreak?: number;
  lastDailyDay?: number;
}

const KEY = "player_state_v1";
let state: PlayerState = { adsRemoved: false, coins: 0, level: 1, sound: true, music: false, haptics: true, stars: {}, tutorialDone: false, holdMs: 400, theme: "paper", ownedThemes: ["paper"] };
const listeners = new Set<(s: PlayerState) => void>();

export const store = {
  async load(): Promise<PlayerState> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<PlayerState>) };
    } catch {
      // first launch / corrupted → defaults
    }
    return state;
  },
  get(): PlayerState {
    return state;
  },
  set(patch: Partial<PlayerState>): void {
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state));
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  },
  subscribe(l: (s: PlayerState) => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
