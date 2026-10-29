/// <reference types="node" />
/**
 * Candidate proposer for the level designer: deals natural minesweeper positions (pods + the opening a
 * first tap would make) and keeps only those whose solve REQUIRES a given technique, use the whole
 * board (no all-empty row/column) and land in a casual win-rate band. The designer reads each
 * candidate, picks one, edits it and writes its intent into src/game/designs.ts.
 *   npx tsx scripts/propose.ts w=6 h=6 pods=7 tier=2 kind=subset|overlap|any n=6 seed=1
 *        rounds=1 safe=16 lo=0 hi=1 open=tap|cut
 */
import { makeBoard, openCell } from "../src/game/board";
import { solve, type Tier } from "../src/game/solver";
import { botRate, view } from "./design";

const arg: Record<string, string> = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.split("="); arg[k] = v; }
const w = Number(arg.w ?? 6), h = Number(arg.h ?? 6), pods = Number(arg.pods ?? 6), tier = Number(arg.tier ?? 1);
const kind = arg.kind ?? "any";
const want = Number(arg.n ?? 6);
let seed = Number(arg.seed ?? 1);
const minRounds = Number(arg.rounds ?? 1);
const maxSafe = Number(arg.safe ?? 16), minSafe = Number(arg.minsafe ?? 3);
const lo = Number(arg.lo ?? 0), hi = Number(arg.hi ?? 1);
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0), seed / 2 ** 32);

function deadStrip(b: ReturnType<typeof makeBoard>, open: boolean[]): boolean {
  const empty = (i: number) => open[i] && b.num[i] === 0;
  for (let y = 0; y < b.h; y++) { let all = true; for (let x = 0; x < b.w; x++) all &&= empty(y * b.w + x); if (all) return true; }
  for (let x = 0; x < b.w; x++) { let all = true; for (let y = 0; y < b.h; y++) all &&= empty(y * b.w + x); if (all) return true; }
  return false;
}

const out: { rows: string[]; casual: number; txt: string }[] = [];
const seen = new Set<string>();
for (let attempt = 0; attempt < 400000 && out.length < want; attempt++) {
  const n = w * h;
  const pod = Array<boolean>(n).fill(false);
  let placed = 0;
  while (placed < pods) { const i = Math.floor(rnd() * n); if (!pod[i]) { pod[i] = true; placed++; } }
  const b = makeBoard(w, h, pod);
  let open: boolean[];
  if (arg.open === "cut") {
    // "cut": a partly-solved position — open a random rectangle's safe cells, closed under cascade.
    const x0 = Math.floor(rnd() * w), y0 = Math.floor(rnd() * h);
    const x1 = Math.min(w - 1, x0 + 1 + Math.floor(rnd() * w)), y1 = Math.min(h - 1, y0 + 1 + Math.floor(rnd() * h));
    open = Array(n).fill(false);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!pod[y * w + x]) open = openCell(b, open, y * w + x).open;
  } else {
    const zeros = pod.map((p, i) => (!p && b.num[i] === 0 ? i : -1)).filter((i) => i >= 0);
    if (!zeros.length) continue;
    open = openCell(b, Array(n).fill(false), zeros[Math.floor(rnd() * zeros.length)]).open;
  }
  const hidden = open.filter((o) => !o).length;
  if (hidden - pods > maxSafe || hidden - pods < minSafe) continue;
  if (deadStrip(b, open)) continue;
  const r = solve(b, open, tier as Tier);
  if (!r.solved) continue;
  if (tier > 1 && solve(b, open, (tier - 1) as Tier).solved) continue;
  if (r.tierRounds[tier] < minRounds) continue;
  if (arg.maxchain !== undefined && r.tierRounds[3] > Number(arg.maxchain)) continue;
  if (arg.mincount !== undefined && r.tierRounds[4] < Number(arg.mincount)) continue;
  if (arg.maxcount !== undefined && r.tierRounds[4] > Number(arg.maxcount)) continue;
  if (arg.minchain !== undefined && r.tierRounds[3] < Number(arg.minchain)) continue;
  if (arg.minpair !== undefined && r.tierRounds[2] < Number(arg.minpair)) continue;
  if (kind !== "any" && tier === 2) {
    const kinds = new Set(r.steps.flatMap((s) => s.kinds));
    if (!kinds.has(kind as "subset" | "overlap")) continue;
    if (kind === "subset" && kinds.has("overlap")) continue;
  }
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let s = "";
    for (let x = 0; x < w; x++) { const k = y * w + x; s += pod[k] ? "*" : open[k] ? "." : "#"; }
    rows.push(s);
  }
  const key = rows.join("|");
  if (seen.has(key)) continue;
  seen.add(key);
  const casual = botRate(b, open, 0.3, 300);
  if (casual < lo || casual > hi) continue;
  const skilled = botRate(b, open, 0.08, 300);
  out.push({ rows, casual, txt: view(b, open) + `\n rounds ${r.tierRounds.join("/")} hidden ${hidden} casual ${casual.toFixed(2)} skilled ${skilled.toFixed(2)}` });
}
out.sort((a, b) => b.casual - a.casual);
for (const c of out) console.log(`\n${JSON.stringify(c.rows)}\n${c.txt}`);
