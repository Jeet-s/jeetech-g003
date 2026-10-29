/// <reference types="node" />
/**
 * Level-design workbench: prints every level (or a scratch board) the way the player sees it, with
 * solver facts, the weakest technique tier that clears it, the oracle-shortest tap count and the
 * expected bot win rates (independent RNG, many trials — the true expectation, not the playtest replica).
 *   npx tsx scripts/design.ts            all levels
 *   npx tsx scripts/design.ts 7 12       levels 7..12
 *   npx tsx scripts/design.ts --rows "##*#,#..#,..##"   a scratch board
 */
import { openCell, parseRows, type Board } from "../src/game/board";
import { obviousPods, solve, TIER_NAMES, difficultyOf, type Tier } from "../src/game/solver";
import { LEVELS } from "../src/game/levels";

const PERS = { skilled: 0.08, casual: 0.3, careless: 0.6 };

export function view(board: Board, open: boolean[]): string {
  const rows: string[] = [];
  for (let r = 0; r < board.h; r++) {
    let s = "";
    for (let c = 0; c < board.w; c++) {
      const k = r * board.w + c;
      s += (open[k] ? (board.pod[k] ? "X" : board.num[k] === 0 ? "." : String(board.num[k])) : board.pod[k] ? "*" : "#") + " ";
    }
    rows.push(s);
  }
  return rows.join("\n");
}

let seed = 12345;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Mirror of scripts/bots.ts playOnce over this game's sim rules, with a sound RNG. */
export function botRate(board: Board, start: boolean[], noise: number, trials: number): number {
  const safeTotal = board.pod.filter((p) => !p).length;
  let wins = 0;
  for (let t = 0; t < trials; t++) {
    let open = start;
    for (let n = 0; n < 400; n++) {
      const spotted = obviousPods(board, open);
      const moves: number[] = [];
      for (let i = 0; i < open.length; i++) if (!open[i] && !spotted[i]) moves.push(i);
      let pick = moves[Math.floor(rnd() * moves.length)];
      if (rnd() > noise) {
        let best = -Infinity;
        for (const m of moves) {
          if (board.pod[m]) continue;
          const nx = openCell(board, open, m).open;
          const cnt = nx.reduce((a, o, i) => a + (o && !board.pod[i] ? 1 : 0), 0);
          const v = cnt === safeTotal ? Infinity : cnt + rnd() * 1e-6;
          if (v > best) { best = v; pick = m; }
        }
      }
      if (board.pod[pick]) break;
      open = openCell(board, open, pick).open;
      const cnt = open.reduce((a, o, i) => a + (o && !board.pod[i] ? 1 : 0), 0);
      if (cnt === safeTotal) { wins++; break; }
    }
  }
  return wins / trials;
}

/** Smallest set (≤5) of numbers whose joint layouts all agree on `cell`. */
function explain(board: Board, open: boolean[], known: boolean[], cell: number, at: (i: number) => string): string {
  const cons: { src: number; cells: number[]; need: number }[] = [];
  for (let i = 0; i < board.pod.length; i++) {
    if (!open[i] || board.pod[i]) continue;
    const cells = board.nbr[i].filter((j) => !open[j] && !known[j]);
    if (!cells.length) continue;
    cons.push({ src: i, cells, need: board.num[i] - board.nbr[i].filter((j) => known[j]).length });
  }
  const near = cons.filter((c) => c.cells.some((x) => board.nbr[cell].includes(x) || x === cell || board.nbr[x].some((y) => board.nbr[cell].includes(y))));
  const agrees = (set: typeof cons): boolean => {
    const cells = [...new Set(set.flatMap((c) => c.cells).concat([cell]))];
    let seenPod = false, seenSafe = false;
    const asg = new Map<number, number>();
    const rec = (k: number): void => {
      if (seenPod && seenSafe) return;
      if (k === cells.length) {
        for (const c of set) if (c.cells.reduce((a, x) => a + asg.get(x)!, 0) !== c.need) return;
        if (asg.get(cell)) seenPod = true; else seenSafe = true;
        return;
      }
      for (const v of [0, 1]) { asg.set(cells[k], v); rec(k + 1); }
      asg.delete(cells[k]);
    };
    rec(0);
    return !(seenPod && seenSafe);
  };
  for (let size = 1; size <= 5; size++) {
    const pick: number[] = [];
    let found: typeof cons | null = null;
    const comb = (start: number) => {
      if (found) return;
      if (pick.length === size) { const set = pick.map((i) => near[i]); if (agrees(set)) found = set; return; }
      for (let i = start; i < near.length; i++) { pick.push(i); comb(i + 1); pick.pop(); }
    };
    comb(0);
    if (found) return `${at(cell)} via ` + (found as typeof cons).map((c) => `${at(c.src)}(${board.num[c.src]}→needs ${c.need} of ${c.cells.length})`).join(" + ");
  }
  return "(needs >5 numbers)";
}

function bfs(board: Board, start: boolean[], cap = 40000): number | null {
  const safeTotal = board.pod.filter((p) => !p).length;
  const key = (o: boolean[]) => o.map((x) => (x ? 1 : 0)).join("");
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let d = 1; frontier.length && seen.size < cap; d++) {
    const next: boolean[][] = [];
    for (const s of frontier)
      for (let i = 0; i < s.length; i++) {
        if (s[i] || board.pod[i]) continue;
        const t = openCell(board, s, i).open;
        if (t.reduce((a, o, k) => a + (o && !board.pod[k] ? 1 : 0), 0) === safeTotal) return d;
        const k = key(t);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(t);
        if (seen.size >= cap) return null;
      }
    frontier = next;
  }
  return null;
}

export function report(label: string, rows: string[], trials = 600) {
  const { board, open } = parseRows(rows);
  const r = solve(board, open, 4);
  let need = 0;
  for (const t of [1, 2, 3, 4] as Tier[]) if (solve(board, open, t).solved) { need = t; break; }
  const hidden = open.filter((o) => !o).length;
  const spotted = obviousPods(board, open).filter(Boolean).length;
  const tiers = r.tierRounds.map((n, t) => (t && n ? `${TIER_NAMES[t]}×${n}` : "")).filter(Boolean).join(" ");
  const rates = Object.entries(PERS).map(([k, v]) => `${k} ${botRate(board, open, v, trials).toFixed(2)}`).join("  ");
  console.log(`\n== ${label}  ${board.w}x${board.h} pods ${board.pods} hidden ${hidden} (safe ${hidden - board.pods}) spotted@start ${spotted}`);
  console.log(view(board, open));
  console.log(`solved ${r.solved} need ${TIER_NAMES[need] ?? "NONE"} | ${tiers} | diff ${difficultyOf(r, hidden)} | optimal ${bfs(board, open)} | ${rates}`);
  if (process.env.STEPS) {
    const at = (i: number) => `r${Math.floor(i / board.w) + 1}c${(i % board.w) + 1}`;
    // replay to know the open mask before each step, and explain chain steps by the fewest numbers that prove them
    let cur = open.slice();
    const known = board.pod.map(() => false);
    r.steps.forEach((s, k) => {
      let why = "";
      if (s.tier === 3) why = "  ← " + explain(board, cur, known, [...s.safe, ...s.pods].slice(0, 1)[0], at);
      console.log(`  ${k + 1}. ${TIER_NAMES[s.tier]}${s.kinds.length ? "/" + s.kinds.join("+") : ""}: safe [${s.safe.map(at).join(" ")}] pods [${s.pods.map(at).join(" ")}]${why}`);
      s.safe.forEach((x) => (cur = openCell(board, cur, x).open));
      s.pods.forEach((x) => (known[x] = true));
    });
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--rows") report("scratch", args[1].split(","));
  else {
    const a = args[0] ? Number(args[0]) : 1, b = args[1] ? Number(args[1]) : args[0] ? a : LEVELS.length;
    for (let n = a; n <= b; n++) report(`L${n} ${LEVELS[n - 1].title} [${LEVELS[n - 1].role}]`, LEVELS[n - 1].rows);
  }
}
