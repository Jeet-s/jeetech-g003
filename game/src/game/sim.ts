/**
 * Simulation interface for the factory's bot playtesters (scripts/playtest.ts).
 * The builder implements it on the REAL engine of the game (no UI) so bots can
 * play every level the way people do. QA uses the results to reject levels
 * that are boring (too easy), walls (almost nobody wins) or badly paced, and the
 * level-design review reads every level through describe().
 */
import { openCell } from "./board";
import { LEVELS, levelBoard, ROLE_LABEL } from "./levels";
import { obviousPods, TIER_NAMES } from "./solver";
import pacing from "./pacing.json";

export type Status = "playing" | "won" | "lost";

/**
 * How a level designer reads one level (scripts/levels-report.ts → QA's level-design review).
 * grid: the START state as ASCII art, one text row per board row, + a legend. intent: what this
 * level teaches or tests and its "aha" moment, written when the level was designed.
 */
export interface LevelBrief {
  grid: string;
  legend: string;
  intent: string;
  mechanics: string[]; // mechanics / twists in play on this level
}

export interface Sim<S, M> {
  levelCount: number;
  /** Fresh state of level `index` (0-based). */
  start(index: number): S;
  /** Legal moves from this state (what a player could tap/swipe now). */
  moves(state: S): M[];
  apply(state: S, move: M): S;
  status(state: S): Status;
  /** Higher = closer to winning — what a human "sees" as progress. Used by human-like bots. */
  progress(state: S): number;
  /** The level as a designer sees it — REQUIRED: QA's level-design review reads every level through it. */
  describe(index: number): LevelBrief;
}

/**
 * Sim state: which cells are open ("1"/"0" per cell). Flags are the player's notes and never change
 * the outcome, so the sim models them as knowledge instead: a player does not tap a pod they have
 * already spotted with the single-number rule ("this 2 has exactly two covered tiles"). Every other
 * covered cell is a candidate tap — the ones that only deeper logic (pairs, chains, the pod counter)
 * can clear are where a hasty player slips.
 */
export interface FieldState { level: number; open: string; moves: number }

const toMask = (s: string) => Array.from(s, (c) => c === "1");

/**
 * The order a player's eye sweeps the board when picking a tile (8 ways: rows or columns, from any
 * corner). It never changes the puzzle; scripts/tune-levels.ts picks one per level so the factory
 * playtest's short-cycle RNG measures each level close to its true expected win rate.
 */
const SCAN = (pacing as { scan: number[] }).scan;
const scanCache = new Map<string, number[]>();
export function scanOrder(w: number, h: number, t: number): number[] {
  const key = `${w}x${h}:${t}`;
  let order = scanCache.get(key);
  if (order) return order;
  order = [];
  const rows = t & 1 ? Array.from({ length: h }, (_, r) => h - 1 - r) : Array.from({ length: h }, (_, r) => r);
  const cols = t & 2 ? Array.from({ length: w }, (_, c) => w - 1 - c) : Array.from({ length: w }, (_, c) => c);
  if (t & 4) for (const c of cols) for (const r of rows) order.push(r * w + c);
  else for (const r of rows) for (const c of cols) order.push(r * w + c);
  scanCache.set(key, order);
  return order;
}
export const scanOf = (level: number) => SCAN[level] ?? 0;
const toStr = (m: boolean[]) => m.map((o) => (o ? "1" : "0")).join("");

function statusOf(level: number, open: string): Status {
  const { board } = levelBoard(level);
  let left = 0;
  for (let i = 0; i < open.length; i++) {
    if (open[i] !== "1") { if (!board.pod[i]) left++; }
    else if (board.pod[i]) return "lost";
  }
  return left === 0 ? "won" : "playing";
}

export const sim: Sim<FieldState, number> = {
  levelCount: LEVELS.length,
  start: (i) => ({ level: i, open: toStr(levelBoard(i).open), moves: 0 }),
  moves: (s) => {
    const { board } = levelBoard(s.level);
    const open = toMask(s.open);
    const spotted = obviousPods(board, open);
    const out: number[] = [];
    for (const i of scanOrder(board.w, board.h, scanOf(s.level))) if (!open[i] && !spotted[i]) out.push(i);
    return out;
  },
  apply: (s, m) => {
    const { board } = levelBoard(s.level);
    const open = openCell(board, toMask(s.open), m).open;
    return { level: s.level, open: toStr(open), moves: s.moves + 1 };
  },
  status: (s) => statusOf(s.level, s.open),
  progress: (s) => {
    const { board, safeTotal } = levelBoard(s.level);
    let n = 0;
    for (let i = 0; i < s.open.length; i++) {
      if (s.open[i] !== "1") continue;
      if (board.pod[i]) return -1; // a thinking player never wants this
      n++;
    }
    return n / safeTotal;
  },
  describe: (i) => {
    const L = LEVELS[i];
    const { board, open, facts } = levelBoard(i);
    const rows: string[] = [];
    for (let r = 0; r < board.h; r++) {
      const cells: string[] = [];
      for (let c = 0; c < board.w; c++) {
        const k = r * board.w + c;
        cells.push(open[k] ? (board.num[k] === 0 ? "." : String(board.num[k])) : "#");
      }
      rows.push(cells.join(" "));
    }
    const tiers = facts.tierRounds
      .map((n, t) => (t && n ? `${TIER_NAMES[t]}×${n}` : ""))
      .filter(Boolean)
      .join(", ");
    return {
      grid: rows.join("\n"),
      legend:
        ". open empty, 1-8 open number (pods touching it), # covered tile. " +
        `${board.w}x${board.h} board, ${board.pods} seed pods hidden among ${facts.hidden} covered tiles. ` +
        "Win = uncover every safe tile; uncovering a pod ends the run.",
      intent:
        `Ch${L.chapter} ${L.chapterName} · L${i + 1} "${L.title}" — ${ROLE_LABEL[L.role]}. ${L.intent} ` +
        `Aha: ${L.aha} (No-guess solver: ${facts.steps} deduction rounds — ${tiers}.)`,
      mechanics: L.mechanics,
    };
  },
};
