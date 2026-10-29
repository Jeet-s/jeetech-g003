/**
 * Campaign levels — hand-designed no-guess puzzles (plan: docs/LEVELS.md).
 * Each level is a real minesweeper position with its opening already uncovered:
 *   '.' open at start   '#' covered safe tile   '*' covered seed pod
 * Numbers are computed by the engine. scripts/validate.ts proves every level clears with logic alone.
 */
import { parseRows, type Board } from "./board";
import { solve, difficultyOf } from "./solver";
import { starTimes } from "./engine";
import { DESIGNS } from "./designs";

export type Role = "teach" | "practise" | "twist" | "combine" | "finale" | "breather";
export const ROLE_LABEL: Record<Role, string> = {
  teach: "TEACH", practise: "PRACTISE", twist: "TWIST", combine: "COMBINE", finale: "FINALE (boss)", breather: "BREATHER",
};

export interface LevelDesign {
  title: string;
  role: Role;
  intent: string; // what it teaches/tests and why it sits here
  aha: string; // the insight the player must find
  hint?: string; // short on-screen coaching (tutorial levels)
  mechanics: string[];
  rows: string[];
}

export interface Chapter { n: number; name: string; theme: "paper" | "garden" | "night"; blurb: string }
export const CHAPTERS: Chapter[] = [
  { n: 1, name: "First Sprouts", theme: "paper", blurb: "Numbers count the pods around them" },
  { n: 2, name: "Garden Wall", theme: "garden", blurb: "Pairs of numbers along an edge" },
  { n: 3, name: "Hedge Rows", theme: "garden", blurb: "1-2-1 and 1-2-2-1 lines" },
  { n: 4, name: "Seed Counter", theme: "paper", blurb: "The pod counter settles the end" },
  { n: 5, name: "Night Sky", theme: "night", blurb: "Follow a what-if to its end" },
  { n: 6, name: "Moonlit Meadow", theme: "night", blurb: "Everything you know, together" },
];

export interface Level extends LevelDesign { number: number; chapter: number; chapterName: string }

export const LEVELS: Level[] = DESIGNS.map((d, i) => {
  const chapter = d.chapter;
  return { ...d.level, number: i + 1, chapter, chapterName: CHAPTERS[chapter - 1].name };
});

export interface LevelFacts {
  hidden: number; // covered tiles at start
  hiddenSafe: number;
  steps: number; // solver deduction rounds
  tierRounds: number[];
  maxTier: number;
  solvable: boolean;
  difficulty: number;
  starTimes: [number, number];
}

const cache = new Map<number, { board: Board; open: boolean[]; safeTotal: number; facts: LevelFacts }>();

/** Parsed board + start mask + solver facts for level `i` (0-based), cached. */
export function levelBoard(i: number) {
  let e = cache.get(i);
  if (e) return e;
  const { board, open } = parseRows(LEVELS[i].rows);
  const r = solve(board, open, 4);
  const hidden = open.filter((o) => !o).length;
  const hiddenSafe = hidden - board.pods;
  e = {
    board, open, safeTotal: board.pod.filter((p) => !p).length,
    facts: {
      hidden, hiddenSafe, steps: r.steps.length, tierRounds: r.tierRounds, maxTier: r.maxTier, solvable: r.solved,
      difficulty: difficultyOf(r, hidden), starTimes: starTimes(r.steps.length, hiddenSafe),
    },
  };
  cache.set(i, e);
  return e;
}
