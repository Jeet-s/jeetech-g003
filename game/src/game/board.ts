/**
 * Cozy Fields — board geometry and the pure minesweeper rules (no UI).
 * A board is a w×h grid of cells; some hold seed pods ("mines"). A revealed safe cell shows how many
 * pods touch it (8-neighbourhood). Revealing a 0 opens its neighbours (cascade).
 */
export interface Board {
  w: number;
  h: number;
  pod: boolean[]; // true = seed pod
  num: number[]; // pods touching each cell (meaningful for safe cells)
  nbr: number[][]; // 8-neighbour indices
  pods: number; // total pods
}

export function neighbours(w: number, h: number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const list: number[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < h && cc >= 0 && cc < w) list.push(rr * w + cc);
        }
      out.push(list);
    }
  return out;
}

const NBR_CACHE = new Map<string, number[][]>();
export function makeBoard(w: number, h: number, pod: boolean[]): Board {
  const key = `${w}x${h}`;
  let nbr = NBR_CACHE.get(key);
  if (!nbr) NBR_CACHE.set(key, (nbr = neighbours(w, h)));
  const num = pod.map((_, i) => nbr![i].reduce((n, j) => n + (pod[j] ? 1 : 0), 0));
  return { w, h, pod, num, nbr, pods: pod.filter(Boolean).length };
}

/**
 * Open cell `i` on a revealed-mask (copy returned). Zeros cascade to their neighbours.
 * Opening a pod just marks it open — callers decide what that means (loss).
 */
export function openCell(b: Board, open: boolean[], i: number, blocked?: (j: number) => boolean): { open: boolean[]; opened: number[] } {
  const next = open.slice();
  const opened: number[] = [];
  if (next[i]) return { open: next, opened };
  const stack = [i];
  next[i] = true;
  opened.push(i);
  while (stack.length) {
    const c = stack.pop()!;
    if (b.pod[c] || b.num[c] !== 0) continue;
    for (const j of b.nbr[c]) {
      if (next[j] || b.pod[j] || (blocked && blocked(j))) continue;
      next[j] = true;
      opened.push(j);
      stack.push(j);
    }
  }
  return { open: next, opened };
}

/** Parse a designed level: rows of '.' (open at start), '#' (hidden safe), '*' (hidden pod). */
export function parseRows(rows: string[]): { board: Board; open: boolean[] } {
  const h = rows.length;
  const w = rows[0].length;
  const pod: boolean[] = [];
  const open: boolean[] = [];
  for (const row of rows) {
    if (row.length !== w) throw new Error(`ragged level row "${row}"`);
    for (const ch of row) {
      if (!".#*".includes(ch)) throw new Error(`bad level char "${ch}"`);
      pod.push(ch === "*");
      open.push(ch === ".");
    }
  }
  const board = makeBoard(w, h, pod);
  // A revealed 0 always opens its neighbours, so close the opening under the cascade.
  let mask = open.map(() => false);
  open.forEach((o, i) => { if (o) mask = openCell(board, mask, i).open; });
  return { board, open: mask };
}
