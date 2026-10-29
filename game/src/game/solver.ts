/**
 * Logical (no-guess) minesweeper solver. It only uses what a player can see — the numbers on open
 * cells and the pod counter — and reports which technique each step needed:
 *   1 single  — one number alone: "needs n, n hidden left → all pods" / "already has n → rest safe"
 *   2 pair    — two overlapping numbers (1-1, 1-2, 1-2-1, subset reasoning)
 *   3 chain   — a whole frontier region reasoned at once (every consistent layout agrees)
 *   4 count   — the pod counter: remaining pods decide the last cells
 * A board is "fair" when this solver opens every safe cell without guessing.
 */
import { openCell, type Board } from "./board";

export const TIER_NAMES = ["", "single", "pair", "chain", "count"] as const;
export type Tier = 1 | 2 | 3 | 4;

export interface SolveStep { tier: Tier; safe: number[]; pods: number[]; kinds: PairKind[] }
/** Tier-2 flavour: one number's covered tiles inside another's (1-1) vs a partial overlap (1-2). */
export type PairKind = "subset" | "overlap";
export interface SolveResult {
  solved: boolean;
  steps: SolveStep[];
  maxTier: number;
  tierRounds: [number, number, number, number, number]; // index = tier
  open: boolean[];
  podKnown: boolean[];
}

interface Constraint { cells: number[]; need: number }

const MAX_ENUM = 26; // cells per region we are willing to enumerate

function constraints(b: Board, open: boolean[], known: boolean[]): Constraint[] {
  const out: Constraint[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < b.pod.length; i++) {
    if (!open[i] || b.pod[i]) continue;
    let need = b.num[i];
    const cells: number[] = [];
    for (const j of b.nbr[i]) {
      if (open[j]) continue;
      if (known[j]) need--;
      else cells.push(j);
    }
    if (!cells.length) continue;
    const key = cells.join(",") + ":" + need;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ cells, need });
  }
  return out;
}

function single(cs: Constraint[]): { safe: Set<number>; pods: Set<number> } {
  const safe = new Set<number>(), pods = new Set<number>();
  for (const c of cs) {
    if (c.need === 0) c.cells.forEach((x) => safe.add(x));
    else if (c.need === c.cells.length) c.cells.forEach((x) => pods.add(x));
  }
  return { safe, pods };
}

function pair(cs: Constraint[]): { safe: Set<number>; pods: Set<number>; kinds: Set<PairKind> } {
  const safe = new Set<number>(), pods = new Set<number>();
  const kinds = new Set<PairKind>();
  const byCell = new Map<number, number[]>();
  cs.forEach((c, k) => c.cells.forEach((x) => byCell.set(x, [...(byCell.get(x) ?? []), k])));
  const tried = new Set<string>();
  for (let a = 0; a < cs.length; a++) {
    const partners = new Set<number>();
    for (const x of cs[a].cells) for (const k of byCell.get(x)!) if (k !== a) partners.add(k);
    for (const bI of partners) {
      const key = a < bI ? `${a}:${bI}` : `${bI}:${a}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const A = cs[a], B = cs[bI];
      const inB = new Set(B.cells);
      const both = A.cells.filter((x) => inB.has(x));
      const inA = new Set(A.cells);
      const onlyA = A.cells.filter((x) => !inB.has(x));
      const onlyB = B.cells.filter((x) => !inA.has(x));
      const maxI = Math.min(both.length, A.need, B.need);
      const minI = Math.max(0, A.need - onlyA.length, B.need - onlyB.length);
      const kind: PairKind = !onlyA.length || !onlyB.length ? "subset" : "overlap";
      for (const [need, only] of [[A.need, onlyA], [B.need, onlyB]] as [number, number[]][]) {
        if (!only.length) continue;
        if (need - maxI === only.length) { only.forEach((x) => pods.add(x)); kinds.add(kind); }
        if (need - minI === 0) { only.forEach((x) => safe.add(x)); kinds.add(kind); }
      }
    }
  }
  return { safe, pods, kinds };
}

/** Enumerate consistent pod layouts per connected frontier region. */
function regions(cs: Constraint[]): { cells: number[]; cons: Constraint[] }[] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const c of cs) for (const x of c.cells) if (!parent.has(x)) parent.set(x, x);
  for (const c of cs) for (let k = 1; k < c.cells.length; k++) parent.set(find(c.cells[k]), find(c.cells[0]));
  const groups = new Map<number, { cells: number[]; cons: Constraint[] }>();
  for (const x of parent.keys()) {
    const r = find(x);
    if (!groups.has(r)) groups.set(r, { cells: [], cons: [] });
    groups.get(r)!.cells.push(x);
  }
  for (const c of cs) groups.get(find(c.cells[0]))!.cons.push(c);
  return [...groups.values()];
}

/** For a region: map podCount → {ways, podTimes per cell}. null when too large to enumerate. */
function enumerate(region: { cells: number[]; cons: Constraint[] }): Map<number, { ways: number; hits: number[] }> | null {
  const cells = region.cells;
  if (cells.length > MAX_ENUM) return null;
  const idx = new Map(cells.map((x, k) => [x, k]));
  const cons = region.cons.map((c) => ({ cells: c.cells.map((x) => idx.get(x)!), need: c.need }));
  const consOf: number[][] = cells.map(() => []);
  cons.forEach((c, k) => c.cells.forEach((x) => consOf[x].push(k)));
  const assigned = new Int8Array(cells.length).fill(-1);
  const placed = cons.map(() => 0);
  const unassigned = cons.map((c) => c.cells.length);
  const result = new Map<number, { ways: number; hits: number[] }>();
  let pods = 0;
  let budget = 400_000;
  const rec = (k: number): boolean => {
    if (--budget < 0) return false;
    if (k === cells.length) {
      let e = result.get(pods);
      if (!e) result.set(pods, (e = { ways: 0, hits: cells.map(() => 0) }));
      e.ways++;
      for (let x = 0; x < cells.length; x++) if (assigned[x] === 1) e.hits[x]++;
      return true;
    }
    for (const v of [0, 1]) {
      let ok = true;
      for (const ci of consOf[k]) {
        const p = placed[ci] + v, u = unassigned[ci] - 1;
        if (p > cons[ci].need || p + u < cons[ci].need) { ok = false; break; }
      }
      if (!ok) continue;
      assigned[k] = v;
      pods += v;
      for (const ci of consOf[k]) { placed[ci] += v; unassigned[ci]--; }
      const fine = rec(k + 1);
      for (const ci of consOf[k]) { placed[ci] -= v; unassigned[ci]++; }
      pods -= v;
      assigned[k] = -1;
      if (!fine) return false;
    }
    return true;
  };
  return rec(0) ? result : null;
}

function chain(cs: Constraint[], useCount: boolean, podsLeft: number, interior: number[]):
  { safe: Set<number>; pods: Set<number> } {
  const safe = new Set<number>(), pods = new Set<number>();
  const regs = regions(cs);
  const enums = regs.map(enumerate);
  if (!useCount) {
    regs.forEach((r, k) => {
      const e = enums[k];
      if (!e) return;
      let total = 0;
      const hits = r.cells.map(() => 0);
      for (const v of e.values()) { total += v.ways; v.hits.forEach((h, x) => (hits[x] += h)); }
      r.cells.forEach((x, i) => { if (hits[i] === 0) safe.add(x); else if (hits[i] === total) pods.add(x); });
    });
    return { safe, pods };
  }
  if (enums.some((e) => !e)) return { safe, pods };
  // Pod counter: which pod-counts per region are compatible with the remaining total?
  const counts = enums.map((e) => [...e!.keys()]);
  const feasible = (k: number, c: number): boolean => {
    // can the other regions + interior absorb podsLeft - c?
    let lo = 0, hi = 0;
    counts.forEach((cs2, j) => { if (j !== k) { lo += Math.min(...cs2); hi += Math.max(...cs2); } });
    const rest = podsLeft - c;
    // other regions give any count in [lo,hi]? Not every value is reachable; do an exact subset-sum.
    if (rest < lo || rest > hi + interior.length) return false;
    const reach = new Set<number>([0]);
    counts.forEach((cs2, j) => {
      if (j === k) return;
      const nx = new Set<number>();
      for (const a of reach) for (const b of cs2) nx.add(a + b);
      reach.clear();
      nx.forEach((v) => reach.add(v));
    });
    for (const v of reach) if (rest - v >= 0 && rest - v <= interior.length) return true;
    return false;
  };
  regs.forEach((r, k) => {
    let total = 0;
    const hits = r.cells.map(() => 0);
    for (const [c, v] of enums[k]!) {
      if (!feasible(k, c)) continue;
      total += v.ways;
      v.hits.forEach((h, x) => (hits[x] += h));
    }
    if (!total) return;
    r.cells.forEach((x, i) => { if (hits[i] === 0) safe.add(x); else if (hits[i] === total) pods.add(x); });
  });
  // Interior: cells touching no number.
  if (interior.length) {
    let minF = 0, maxF = 0;
    counts.forEach((cs2) => { minF += Math.min(...cs2); maxF += Math.max(...cs2); });
    if (podsLeft - maxF >= interior.length && podsLeft - minF <= interior.length) {
      // reachable sums all leave exactly interior.length → interior all pods
      interior.forEach((x) => pods.add(x));
    } else {
      const reach = new Set<number>([0]);
      counts.forEach((cs2) => {
        const nx = new Set<number>();
        for (const a of reach) for (const b of cs2) nx.add(a + b);
        reach.clear();
        nx.forEach((v) => reach.add(v));
      });
      const leftovers = [...reach].map((v) => podsLeft - v).filter((v) => v >= 0 && v <= interior.length);
      if (leftovers.length && leftovers.every((v) => v === 0)) interior.forEach((x) => safe.add(x));
      else if (leftovers.length && leftovers.every((v) => v === interior.length)) interior.forEach((x) => pods.add(x));
    }
  }
  return { safe, pods };
}

/**
 * Solve from a start mask. `maxTier` caps the techniques allowed; `useCount` lets tier 4 use the
 * pod counter (the counter is always on screen, so it is fair game).
 */
export function solve(b: Board, start: boolean[], maxTier: Tier = 4): SolveResult {
  let open = start.slice();
  const known = b.pod.map(() => false);
  const steps: SolveStep[] = [];
  const tierRounds: SolveResult["tierRounds"] = [0, 0, 0, 0, 0];
  let maxUsed = 0;
  const safeTotal = b.pod.filter((p) => !p).length;
  for (let guard = 0; guard < 10_000; guard++) {
    const openCount = open.reduce((n, o, i) => n + (o && !b.pod[i] ? 1 : 0), 0);
    if (openCount === safeTotal) break;
    const cs = constraints(b, open, known);
    let found: { safe: Set<number>; pods: Set<number>; kinds?: Set<PairKind> } | null = null;
    let tier: Tier = 1;
    for (const t of [1, 2, 3, 4] as Tier[]) {
      if (t > maxTier) break;
      let r: { safe: Set<number>; pods: Set<number>; kinds?: Set<PairKind> };
      if (t === 1) r = single(cs);
      else if (t === 2) r = pair(cs);
      else if (t === 3) r = chain(cs, false, 0, []);
      else {
        const touched = new Set<number>();
        cs.forEach((c) => c.cells.forEach((x) => touched.add(x)));
        const interior: number[] = [];
        for (let i = 0; i < b.pod.length; i++) if (!open[i] && !known[i] && !touched.has(i)) interior.push(i);
        const podsLeft = b.pods - known.filter(Boolean).length;
        r = chain(cs, true, podsLeft, interior);
      }
      // drop anything already known
      r.safe.forEach((x) => { if (open[x]) r.safe.delete(x); });
      r.pods.forEach((x) => { if (known[x]) r.pods.delete(x); });
      if (r.safe.size || r.pods.size) { found = r; tier = t; break; }
    }
    if (!found) break;
    for (const x of found.safe) {
      if (b.pod[x]) throw new Error("solver deduced a pod as safe — logic bug");
      open = openCell(b, open, x).open;
    }
    for (const x of found.pods) {
      if (!b.pod[x]) throw new Error("solver deduced a safe cell as pod — logic bug");
      known[x] = true;
    }
    steps.push({ tier, safe: [...found.safe], pods: [...found.pods], kinds: [...(found.kinds ?? [])] });
    tierRounds[tier]++;
    maxUsed = Math.max(maxUsed, tier);
  }
  const openCount = open.reduce((n, o, i) => n + (o && !b.pod[i] ? 1 : 0), 0);
  return { solved: openCount === safeTotal, steps, maxTier: maxUsed, tierRounds, open, podKnown: known };
}

/** Pods a careful-but-casual player has certainly spotted: the single-number rule, iterated. */
export function obviousPods(b: Board, open: boolean[]): boolean[] {
  const known = b.pod.map(() => false);
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < b.pod.length; i++) {
      if (!open[i] || b.pod[i] || b.num[i] === 0) continue;
      let hidden = 0, k = 0;
      for (const j of b.nbr[i]) if (!open[j]) { hidden++; if (known[j]) k++; }
      if (hidden > k && hidden === b.num[i]) {
        for (const j of b.nbr[i]) if (!open[j] && !known[j]) { known[j] = true; changed = true; }
      }
    }
  }
  return known;
}

/**
 * Difficulty from the solver: every deduction round weighted by how many numbers it has to combine
 * (single 1, pair 3, a three-plus-number chain 10, the whole-board pod count 8), scaled by the
 * covered area the player has to keep in mind.
 */
export const TIER_WEIGHT = [0, 1, 3, 10, 8];
export function difficultyOf(r: SolveResult, hiddenCells: number): number {
  const work = r.steps.reduce((s, st) => s + TIER_WEIGHT[st.tier], 0);
  return Number((work * (1 + hiddenCells / 8)).toFixed(2));
}
