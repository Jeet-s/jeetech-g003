/**
 * Cozy Fields game engine (pure TypeScript, no UI). Classic minesweeper rules:
 *  - tap a hidden cell to reveal it; a pod ends the run (classic modes) — the board stays on screen for review
 *  - flags are the player's notes: they block accidental taps and drive "chord" (tap a satisfied number
 *    to open its other neighbours) but never change the rules
 *  - win = every safe cell revealed
 *  - one free Undo per game (it can take back the fatal tap)
 * Campaign levels start partly open (designed puzzles); classic modes start fully hidden and place pods
 * after the first tap (first tap is always safe and opens a region; boards are generated no-guess).
 */
import { makeBoard, openCell, type Board } from "./board";
import { solve } from "./solver";

export type CellView = "hidden" | "flag" | "open";
export type GameStatus = "ready" | "playing" | "won" | "lost";
export type ActionKind = "reveal" | "flag" | "chord" | "undo";

export interface GameState {
  board: Board | null; // null until the first tap of a classic board (pods not placed yet)
  w: number;
  h: number;
  podCount: number;
  open: boolean[];
  flag: boolean[];
  status: GameStatus;
  taps: number; // player actions that changed the board
  mistakes: number; // pods tapped (only non-zero after an undo or in cozy mode)
  undoLeft: number;
  usedUndo: boolean;
  hintsUsed: number;
  lastAction: { kind: ActionKind; cell: number } | null;
  burst: number | null; // the pod that ended the run
  prev: Snapshot | null; // single-step undo
  seed: number; // classic boards: generator seed (shareable / repro)
  cozy: boolean; // No-Fail Cozy: a pod costs a mistake, never the run
}

type Snapshot = Pick<GameState, "open" | "flag" | "status" | "burst" | "lastAction" | "taps">;

const snap = (s: GameState): Snapshot => ({ open: s.open, flag: s.flag, status: s.status, burst: s.burst, lastAction: s.lastAction, taps: s.taps });

/** A designed board with its opening already revealed. */
export function newGameFromBoard(board: Board, open: boolean[]): GameState {
  return {
    board, w: board.w, h: board.h, podCount: board.pods,
    open: open.slice(), flag: board.pod.map(() => false), status: "playing",
    taps: 0, mistakes: 0, undoLeft: 1, usedUndo: false, hintsUsed: 0, lastAction: null, burst: null, prev: null,
    seed: 0, cozy: false,
  };
}

/** A classic board: nothing placed until the first tap. */
export function newClassicGame(w: number, h: number, pods: number, seed: number, cozy = false): GameState {
  const n = w * h;
  return {
    board: null, w, h, podCount: Math.min(pods, n - 9),
    open: Array(n).fill(false), flag: Array(n).fill(false), status: "ready",
    taps: 0, mistakes: 0, undoLeft: 1, usedUndo: false, hintsUsed: 0, lastAction: null, burst: null, prev: null,
    seed, cozy,
  };
}

export const safeLeft = (s: GameState): number =>
  s.board ? s.board.pod.reduce((n, p, i) => n + (!p && !s.open[i] ? 1 : 0), 0) : s.w * s.h - s.podCount;
export const flagsPlaced = (s: GameState): number => s.flag.filter(Boolean).length;
/** The pod counter shown in the HUD (can go negative if over-flagged, like the classic). */
export const podsRemaining = (s: GameState): number => s.podCount - flagsPlaced(s);

function finish(s: GameState): GameState {
  if (s.status === "playing" && s.board && safeLeft(s) === 0) {
    // Classic polish: on a win every pod gets its flag.
    return { ...s, status: "won", flag: s.board.pod.slice() };
  }
  return s;
}

export function reveal(s: GameState, i: number): GameState {
  if (s.status === "won" || s.status === "lost" || s.open[i] || s.flag[i]) return s;
  let board = s.board;
  if (!board) board = generateClassic(s.w, s.h, s.podCount, s.seed, i).board;
  const prev = snap(s);
  if (board.pod[i]) {
    if (s.cozy) {
      // Cozy mode: the pod is flagged for you and counts as a mistake.
      const flag = s.flag.slice();
      flag[i] = true;
      return { ...s, board, flag, mistakes: s.mistakes + 1, taps: s.taps + 1, lastAction: { kind: "reveal", cell: i }, prev };
    }
    const open = s.open.slice();
    open[i] = true;
    return { ...s, board, open, status: "lost", burst: i, taps: s.taps + 1, lastAction: { kind: "reveal", cell: i }, prev };
  }
  const { open } = openCell(board, s.open, i, (j) => s.flag[j]);
  return finish({ ...s, board, open, status: "playing", taps: s.taps + 1, lastAction: { kind: "reveal", cell: i }, prev });
}

export function toggleFlag(s: GameState, i: number): GameState {
  if (s.status !== "playing" || s.open[i]) return s;
  const flag = s.flag.slice();
  flag[i] = !flag[i];
  return { ...s, flag, lastAction: { kind: "flag", cell: i }, prev: snap(s) };
}

/** Chord: tap an open number whose flags match it → open its other hidden neighbours. */
export function chord(s: GameState, i: number): GameState {
  const b = s.board;
  if (!b || s.status !== "playing" || !s.open[i] || b.num[i] === 0) return s;
  const around = b.nbr[i];
  if (around.filter((j) => s.flag[j]).length !== b.num[i]) return s;
  const targets = around.filter((j) => !s.open[j] && !s.flag[j]);
  if (!targets.length) return s;
  const prev = snap(s);
  let open = s.open;
  let burst: number | null = null;
  for (const j of targets) {
    if (b.pod[j]) { burst = burst ?? j; continue; }
    open = openCell(b, open, j, (k) => s.flag[k]).open;
  }
  if (burst !== null && !s.cozy) {
    open = open.slice();
    open[burst] = true;
    return { ...s, open, status: "lost", burst, taps: s.taps + 1, lastAction: { kind: "chord", cell: i }, prev };
  }
  let flag = s.flag;
  let mistakes = s.mistakes;
  if (burst !== null) {
    flag = flag.slice();
    targets.forEach((j) => { if (b.pod[j]) { flag[j] = true; mistakes++; } });
  }
  return finish({ ...s, open, flag, mistakes, taps: s.taps + 1, lastAction: { kind: "chord", cell: i }, prev });
}

/** One free undo per game: restores the board before the last action (including a fatal tap). */
export function undo(s: GameState): GameState {
  if (!s.prev || s.undoLeft <= 0 || s.status === "won") return s;
  const wasLoss = s.status === "lost";
  return {
    ...s, ...s.prev, prev: null, undoLeft: s.undoLeft - 1, usedUndo: true,
    mistakes: s.mistakes + (wasLoss ? 1 : 0),
    lastAction: s.lastAction ? { kind: "undo", cell: s.lastAction.cell } : null,
  };
}

/** Rewarded revive: the burst pod becomes a flag and play continues (1 per game, enforced by the UI). */
export function revive(s: GameState): GameState {
  if (s.status !== "lost" || s.burst === null) return s;
  const open = s.open.slice();
  open[s.burst] = false;
  const flag = s.flag.slice();
  flag[s.burst] = true;
  return { ...s, open, flag, status: "playing", burst: null, mistakes: s.mistakes + 1, prev: null };
}

/**
 * Hint: confirm ONE hidden cell — the solver's next certain deduction (a safe cell to open, else a pod
 * to flag). Never reveals more than one cell. Returns null when nothing is certain.
 */
export function hint(s: GameState): { cell: number; pod: boolean } | null {
  const b = s.board;
  if (!b || s.status !== "playing") return null;
  const r = solve(b, s.open, 4);
  for (const st of r.steps) {
    const safe = st.safe.find((x) => !s.open[x]);
    if (safe !== undefined) return { cell: safe, pod: false };
    const pod = st.pods.find((x) => !s.flag[x]);
    if (pod !== undefined) return { cell: pod, pod: true };
  }
  return null;
}

// ---------------------------------------------------------------- scoring & stars

/** Star thresholds in seconds: [3★, 2★]. Anything slower but won is 1★. */
export function starTimes(logicSteps: number, hiddenSafe: number): [number, number] {
  const three = Math.round(10 + logicSteps * 4 + hiddenSafe * 1.2);
  return [three, Math.round(three * 1.8)];
}

export function starsFor(seconds: number, times: [number, number], usedUndo: boolean, hintsUsed: number): 1 | 2 | 3 {
  let stars: 1 | 2 | 3 = seconds <= times[0] ? 3 : seconds <= times[1] ? 2 : 1;
  if ((usedUndo || hintsUsed > 0) && stars === 3) stars = 2;
  return stars;
}

/** Leaves earned for a win (GDD: +10 base + time bonus), and the consolation for a loss. */
export function leavesFor(stars: number, firstClear: boolean): number {
  return (firstClear ? 10 : 4) + (stars - 1) * 3;
}
export const LOSS_LEAVES = 2;

// ---------------------------------------------------------------- classic generator

export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ClassicMode { id: string; name: string; w: number; h: number; pods: number }
export const MODES: ClassicMode[] = [
  { id: "beginner", name: "Beginner", w: 8, h: 8, pods: 6 },
  { id: "easy", name: "Easy", w: 9, h: 9, pods: 10 },
  { id: "classic", name: "Classic", w: 9, h: 9, pods: 12 },
  { id: "intermediate", name: "Intermediate", w: 16, h: 16, pods: 40 },
  { id: "expert", name: "Expert", w: 16, h: 30, pods: 96 },
];

/**
 * No-guess classic board: pods avoid the first tap and its neighbours, and the board is re-rolled until
 * the logical solver clears it from that first opening. `solvable` is false only for chaos densities
 * where no fair board turned up within the attempt cap.
 */
export function generateClassic(w: number, h: number, pods: number, seed: number, first: number, attempts = 400):
  { board: Board; solvable: boolean; tries: number } {
  const rand = rng(seed);
  const n = w * h;
  const fr = Math.floor(first / w), fc = first % w;
  const banned = (i: number) => Math.abs(Math.floor(i / w) - fr) <= 1 && Math.abs((i % w) - fc) <= 1;
  const pool = Array.from({ length: n }, (_, i) => i).filter((i) => !banned(i));
  const count = Math.min(pods, pool.length);
  let last: Board | null = null;
  for (let t = 1; t <= attempts; t++) {
    const p = pool.slice();
    for (let k = p.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [p[k], p[j]] = [p[j], p[k]];
    }
    const pod = Array<boolean>(n).fill(false);
    for (let k = 0; k < count; k++) pod[p[k]] = true;
    const board = makeBoard(w, h, pod);
    last = board;
    const start = openCell(board, Array(n).fill(false), first).open;
    if (solve(board, start, 4).solved) return { board, solvable: true, tries: t };
  }
  return { board: last!, solvable: false, tries: attempts };
}

/** Daily board: same seed for everyone on a calendar day; three tiers. */
export function dailySeed(date: Date, tier: 0 | 1 | 2): number {
  const d = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return (d * 31 + tier * 7919) >>> 0;
}
export const DAILY_TIERS: ClassicMode[] = [
  { id: "daily-sprout", name: "Sprout", w: 8, h: 8, pods: 8 },
  { id: "daily-bloom", name: "Bloom", w: 9, h: 9, pods: 13 },
  { id: "daily-grove", name: "Grove", w: 12, h: 12, pods: 24 },
];
