/// <reference types="node" />
/**
 * Level validation — run by the factory's QA with `npm run validate`.
 * For EVERY campaign level:
 *  1. load it through the real engine (src/game/levels → engine.newGameFromBoard),
 *  2. PROVE it clears without guessing: the logical solver (src/game/solver) derives every deduction
 *     from visible numbers + the pod counter only, and each deduction is replayed as a real move
 *     (reveal / flag) on the engine — the game must end "won" and never "lost",
 *  3. check it is a fair, distinct puzzle (no duplicate start, opening consistent, every row/column used),
 *  4. measure difficulty from the solver: deduction rounds weighted by technique × board size.
 * Also checks the classic modes' generator: first tap safe + no-guess on a batch of seeds.
 * Final stdout line: {"levels": N, "solvable": N, "difficulty": [d1..dN]}
 */
import { LEVELS, levelBoard } from "../src/game/levels";
import { newGameFromBoard, reveal, toggleFlag, generateClassic, MODES, DAILY_TIERS, dailySeed } from "../src/game/engine";
import { solve, TIER_NAMES } from "../src/game/solver";
import { openCell } from "../src/game/board";

const problems: string[] = [];
let solvable = 0;
const difficulty: number[] = [];
const seen = new Map<string, number>();

LEVELS.forEach((L, i) => {
  const n = i + 1;
  const { board, open, facts } = levelBoard(i);
  // consistency: an open zero never borders a covered tile (the cascade would have opened it)
  open.forEach((o, k) => {
    if (o && !board.pod[k] && board.num[k] === 0 && board.nbr[k].some((j) => !open[j])) problems.push(`L${n}: open 0 next to a covered tile`);
    if (o && board.pod[k]) problems.push(`L${n}: a pod is open at start`);
  });
  for (let r = 0; r < board.h; r++) {
    if (Array.from({ length: board.w }, (_, c) => r * board.w + c).every((k) => open[k] && board.num[k] === 0)) problems.push(`L${n}: row ${r + 1} is empty filler`);
  }
  for (let c = 0; c < board.w; c++) {
    if (Array.from({ length: board.h }, (_, r) => r * board.w + c).every((k) => open[k] && board.num[k] === 0)) problems.push(`L${n}: column ${c + 1} is empty filler`);
  }
  const key = `${board.w}x${board.h}:` + board.pod.map((p, k) => (p ? "*" : open[k] ? "." : "#")).join("");
  if (seen.has(key)) problems.push(`L${n}: same start as L${seen.get(key)}`);
  seen.set(key, n);

  // proof by replay on the engine
  const proof = solve(board, open, 4);
  let g = newGameFromBoard(board, open);
  for (const step of proof.steps) {
    for (const x of step.pods) if (!g.flag[x]) g = toggleFlag(g, x);
    for (const x of step.safe) if (!g.open[x]) g = reveal(g, x);
    if (g.status === "lost") break;
  }
  const ok = proof.solved && g.status === "won" && open.some((o) => !o);
  if (ok) solvable++;
  else problems.push(`L${n} "${L.title}": not provably solvable (solver ${proof.solved}, engine ${g.status})`);
  difficulty.push(facts.difficulty);
  const tiers = proof.tierRounds.map((k, t) => (t && k ? `${TIER_NAMES[t]}×${k}` : "")).filter(Boolean).join(" ");
  console.log(`L${String(n).padStart(2)} ${L.title.padEnd(18)} ${board.w}x${board.h} pods ${String(board.pods).padStart(2)} covered ${String(facts.hidden).padStart(2)} | ${tiers.padEnd(36)} | difficulty ${facts.difficulty}`);
});

// Chapter technique gates: each chapter's levels must need that chapter's idea.
const needTier = (i: number) => {
  const { board, open } = levelBoard(i);
  for (const t of [1, 2, 3, 4] as const) if (solve(board, open, t).solved) return t;
  return 5;
};
const chapterNeeds: Record<number, number[]> = { 1: [1], 2: [2], 3: [2], 4: [4], 5: [3], 6: [3, 4] };
LEVELS.forEach((L, i) => {
  if (!chapterNeeds[L.chapter].includes(needTier(i))) problems.push(`L${i + 1}: does not need chapter ${L.chapter}'s technique`);
});

// Classic modes: first tap always safe and boards no-guess (QA: 500-seed pass).
let classicOk = 0, classicN = 0;
for (const m of [...MODES, ...DAILY_TIERS]) {
  const seeds = m.id === "expert" ? 20 : 60;
  for (let s = 1; s <= seeds; s++) {
    const first = (s * 7919) % (m.w * m.h);
    const { board, solvable: fair } = generateClassic(m.w, m.h, m.pods, s * 104729 + 1, first);
    classicN++;
    const start = openCell(board, Array(m.w * m.h).fill(false), first).open;
    if (!board.pod[first] && fair && solve(board, start, 4).solved) classicOk++;
    else problems.push(`classic ${m.id} seed ${s}: unfair board`);
  }
}
dailySeed(new Date(2026, 0, 1), 0);
console.log(`classic boards: ${classicOk}/${classicN} first-tap-safe and no-guess`);

const third = Math.floor(LEVELS.length / 3);
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const early = avg(difficulty.slice(0, third)), late = avg(difficulty.slice(-third));
console.log(`difficulty: first third ${early.toFixed(1)}, last third ${late.toFixed(1)} (×${(late / early).toFixed(1)})`);
if (LEVELS.length < 30) problems.push("fewer than 30 levels");
if (late < 3 * early) problems.push("late levels are not ≥3x harder than early ones");
for (const p of problems) console.error("FAIL " + p);
console.log(JSON.stringify({ levels: LEVELS.length, solvable, difficulty }));
process.exit(problems.length ? 1 : 0);
