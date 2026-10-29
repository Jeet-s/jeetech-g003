/**
 * The 36 campaign puzzles in play order — plan and reasoning in docs/LEVELS.md.
 * Rows: '.' open at start (closed under the zero cascade), '#' covered safe tile, '*' covered seed pod.
 * Positions name tiles as "row r, column c" counted from the top-left, matching describe().
 * scripts/propose.ts dealt candidate positions for the practise/combine slots; every kept board was read,
 * chosen and placed by hand for the insight it forces (solver trace: npx tsx scripts/design.ts N with STEPS=1).
 */
import type { LevelDesign } from "./levels";

const FULL = "full number (covered tiles = its count → all pods)";
const CLEAR = "satisfied number (its pods found → other tiles safe)";
const CHAINED = "chained reveals (each opened tile is a new clue)";
const PAIR11 = "1-1 pair (a number's tiles inside its neighbour's)";
const REDUCED = "reduced number (count minus pods already found)";
const PAIR12 = "1-2 pair (the extra pod sits where only the bigger number reaches)";
const COUNTER = "pod counter (pods left in the whole field)";
const NEST = "three-number proof (two smaller needs inside one bigger number)";
const CORNER = "corner proof (three 2s around an opening's corner)";

export const DESIGNS: { chapter: number; level: LevelDesign }[] = [
  // ───────────── Chapter 1 · First Sprouts — the number rule, one number at a time
  { chapter: 1, level: {
    title: "Two Sprouts", role: "teach",
    intent: "First contact with the rule: a number counts the seed pods in the 8 tiles around it. Smallest possible field that needs both actions — flag, then reveal.",
    aha: "The middle 2 on top touches exactly two covered tiles, so both are pods; with them flagged every 1 already has its pod, so all six other covered tiles are safe.",
    hint: "The top-middle 2 touches exactly two covered tiles, so both hide seed pods. Flag them — then every other covered tile is safe.",
    mechanics: [FULL, CLEAR],
    rows: [".....", "#*.*#", "##.##"] } },
  { chapter: 1, level: {
    title: "Corner Seeds", role: "teach",
    intent: "Teaches the second half of the rule on its own: a number whose pods are found makes its other tiles safe. Two mirrored corners — learn it once, apply it again.",
    aha: "The 1 at row 3, column 1 touches a single covered tile, so that's the pod; the 1 at the top (row 1, column 2) is then full, which makes the top-left corner safe. The bottom-right corner is the same trick turned around.",
    hint: "This 1 touches only one covered tile — the pod. Now the 1 above it is full, so its other tile is safe.",
    mechanics: [FULL, CLEAR],
    rows: ["##..", "*#..", "..#*", "..##"] } },
  { chapter: 1, level: {
    title: "Follow the Thread", role: "practise",
    intent: "Practises chaining both halves: you can't solve the bottom until the left wall opens, and every tile you open hands you the next clue.",
    aha: "The two 2s on the left wall pin both top pods; the 1 under them is then full, which opens the left column — and those new numbers point at the bottom pod, which in turn clears the bottom-right corner.",
    hint: "Every tile you open is a new clue. Start from what you're sure of and work outward.",
    mechanics: [FULL, CLEAR, CHAINED],
    rows: ["*....", "*....", "#....", "#...*", "##*##"] } },
  { chapter: 1, level: {
    title: "Garden Corner", role: "practise",
    intent: "Same rule on an L-shaped frontier with a big covered block — teaches that a scary block is solved from its edge inward, one full number at a time.",
    aha: "The 2 at the bottom-left and the 2 inside the bend each touch exactly two covered tiles — four pods at once. That makes the 3 full, so the tiles beside it open and the right-hand block falls from the bottom up; the lone top 1 only resolves at the very end.",
    mechanics: [FULL, CLEAR, CHAINED],
    rows: ["....*#", "....##", "...*##", "...*##", "**####"] } },
  { chapter: 1, level: {
    title: "Full Hands", role: "twist",
    intent: "Twist: the big numbers are where the SAFE tiles come from. Each 4 sees five covered tiles, so it decides nothing at first — until the small numbers around it hand it its four pods.",
    aha: "The 3 and the small numbers beside the 4s are full: flag those seven pods. Now each 4 already has its four, so the fifth tile it sees is safe — and from there the hidden right column and bottom row open one ring at a time.",
    mechanics: [FULL, CLEAR, CHAINED],
    rows: ["..**##", "....*#", "....*#", "....*#", "..**##", "#*####"] } },
  { chapter: 1, level: {
    title: "Ring of Seeds", role: "finale",
    intent: "Chapter 1 boss: the opening sits in the middle of a covered ring. No new idea — a seven-link chain all the way round the frame, and you must find the side where it starts.",
    aha: "Start on the right: the 3 and the 2s there pin a column of pods. Go over the top (the 1-1-1 points at the single top pod), then come down the left side — every link is one full or satisfied number.",
    mechanics: [FULL, CLEAR, CHAINED],
    rows: ["###*##", "#*...#", "*....#", "*....*", "#....*", "#*...*"] } },

  // ───────────── Chapter 2 · Garden Wall — compare two numbers (the 1-1)
  { chapter: 2, level: {
    title: "Wall Twins", role: "teach",
    intent: "Teaches the 1-1 on a tiny board after the chapter-1 boss: at the right edge no single number decides anything — you have to compare two neighbours.",
    aha: "The lower 1 on the right edge has its pod in one of two tiles; the 1 above it sees those same two tiles plus one more. They share the pod, so the extra tile (row 2, right edge) is safe.",
    hint: "Compare the two 1s on the right edge: they share one pod, so the extra tile the upper 1 sees is safe.",
    mechanics: [PAIR11, FULL, CLEAR],
    rows: ["##*##", "*...#", "....#", "....*"] } },
  { chapter: 2, level: {
    title: "Garden Path", role: "practise",
    intent: "Practises the 1-1 at the end of a solve: single numbers clear the left side, and the last corner needs the new idea — twice.",
    aha: "After the left wall falls, the bottom-right corner 1 and the 1 beside it share one pod: the tile under the 3 is safe, and the same pair also clears the far corner.",
    mechanics: [PAIR11, FULL, CLEAR, CHAINED],
    rows: [".....*", "......", "*.....", "##*...", "##*#*#"] } },
  { chapter: 2, level: {
    title: "Hedge Corner", role: "practise",
    intent: "Practises the 1-1 with a 2 that only behaves like a 1 — introduces reading a number minus the pods already found next to it.",
    aha: "The 2 above the bottom row already touches one found pod, so it really needs just one more — a 1 in disguise. With the corner 1 that's a 1-1, which proves the tile under its left side safe.",
    mechanics: [PAIR11, REDUCED, FULL, CLEAR],
    rows: ["*.....", "*.....", "#.....", "#.....", "##**..", "##*#*#"] } },
  { chapter: 2, level: {
    title: "Long Wall", role: "twist",
    intent: "Twist: the 1-1 turned on its side and repeated. A column of 1s faces a covered strip two tiles wide, and the pair rule has to zip down it four times before any pod shows itself.",
    aha: "Each pair of stacked 1s overlaps by two tiles, so the third tile one of them sees is safe. Zip down the wall pair by pair; the pods in the strip only appear once both columns are open.",
    mechanics: [PAIR11, CLEAR, CHAINED],
    rows: ["##...*", "#*...*", "##....", "##....", "#**..*", "##*..."] } },
  { chapter: 2, level: {
    title: "Two Fronts", role: "combine",
    intent: "Combines chapters 1 and 2 on a wider field: a right pocket of pure single-number work and a left strip that only opens with 1-1 reads.",
    aha: "The right pocket is just full numbers. The left strip needs two 1-1 reads along the column of 1s (first rows 3-4, then rows 1-2) before single numbers can finish it.",
    mechanics: [PAIR11, FULL, CLEAR, CHAINED],
    rows: ["##*....", "##.....", "**....*", "##...*#", "##....*", "#*....*"] } },
  { chapter: 2, level: {
    title: "Bramble Box", role: "finale",
    intent: "Chapter 2 boss: the longest solve so far. Pods along the walls come easily; the bottom row needs the pair idea three separate times, in different spots.",
    aha: "Use the pods you've already found to shrink the 2s into 1s; then the bottom row unlocks with three separate 1-1 reads — left of centre, right of centre, then up the right edge.",
    mechanics: [PAIR11, REDUCED, FULL, CLEAR, CHAINED],
    rows: ["*......", "*......", "#....**", "*....*#", "#*...*#", "##...##", "#*##*##"] } },

  // ───────────── Chapter 3 · Hedge Rows — the 1-2 and its family
  { chapter: 3, level: {
    title: "One-Two", role: "teach",
    intent: "Teaches the 1-2 on a small board: a 2 next to a 1 against a wall. The 1 can only share one pod, so the 2's extra pod has to sit where only the 2 can reach.",
    aha: "Bottom-left: the 1 sees two covered tiles, and the 2 next to it sees those two plus one more. The 1 can only give the 2 one pod, so the third tile is a pod — the same 1-2 idea then places the second bottom pod, and the covered block on the right unwinds column by column.",
    hint: "The 2 needs one more pod than the 1 beside it can share — so the tile only the 2 touches is a pod.",
    mechanics: [PAIR12, FULL, CLEAR],
    rows: ["...##*", "...*##", "...###", "#**###"] } },
  { chapter: 3, level: {
    title: "Two-Step", role: "practise",
    intent: "Practises the 1-2 with a big number in disguise, then mixes it back with the 1-1 so the player has to choose which pair idea fits.",
    aha: "On the bottom row the 3 already has one pod beside it, so it's really a 2 next to a 1: that 1-2 places the bottom-left pod and clears the tile under the 1. The right side then opens with two 1-1 reads down the covered column.",
    mechanics: [PAIR12, PAIR11, REDUCED, FULL],
    rows: ["...*##", "....*#", "....##", "*...##", "*#*###"] } },
  { chapter: 3, level: {
    title: "Bent Row", role: "practise",
    intent: "Practises the 1-2 inside a longer line of numbers. The pattern sits among other numbers instead of on a clean wall.",
    aha: "Along the bottom, the 3 (already holding one pod) and the 1 beside it form a 1-2: the second bottom pod goes where only the 3 reaches, and the tile under the 2 is safe. The left wall then needs one 1-1 to finish.",
    mechanics: [PAIR12, PAIR11, REDUCED, CHAINED],
    rows: ["#*....", "#.....", "*.....", "#...*#", "##*#*#"] } },
  { chapter: 3, level: {
    title: "Deep Pocket", role: "twist",
    intent: "Twist: the covered strip is two rows deep and the numbers only touch the first row. The pair rules aren't the answer here — they're the tool that makes clues for tiles no number can see yet.",
    aha: "Solve the first covered row with pair reads from the right edge inward. Each tile you open there becomes a new number that reaches into the hidden second row, which you then solve the same way.",
    mechanics: [PAIR12, PAIR11, CHAINED],
    rows: ["#*###*", "#*###*", "....*#", "....##", "....##", "*...*#"] } },
  { chapter: 3, level: {
    title: "Thornbush", role: "combine",
    intent: "Combines 1-2 and 1-1 in sequence: one 1-2 near the corner unlocks a whole column of 1-1 reads.",
    aha: "Once the easy pods are flagged, the 3 near the top right and the number below it form a 1-2 that places the top-right corner pod. The right column then falls to three 1-1 reads, top to bottom.",
    mechanics: [PAIR12, PAIR11, REDUCED, FULL],
    rows: ["#...**#", "*....*#", ".....##", ".....##", "....**#", "...**##"] } },
  { chapter: 3, level: {
    title: "Hedge Maze", role: "finale",
    intent: "Chapter 3 boss: two separate 1-2 reads open the case, then a whole row that no number touches at the start has to be unzipped.",
    aha: "One 1-2 sits under the top-right 4 and another along the left column of 3-4. Together they open the field, and then the bottom row — invisible to every number at the start — unzips right to left with 1-1 reads.",
    mechanics: [PAIR12, PAIR11, REDUCED, FULL, CHAINED],
    rows: ["....***", "......#", "*.....*", "*.....#", "*...*##", "**##*##", "#######"] } },

  // ───────────── Chapter 4 · Seed Counter — the counter is a clue too
  { chapter: 4, level: {
    title: "Four Seeds", role: "teach",
    intent: "Teaches the pod counter as a clue, on a small pinwheel ring. No number can move first: every one of them is happy with several layouts, and only the counter rules out the ones with too many pods.",
    aha: "The four sides each need a pod of their own from tiles no other side shares — that is already four pods, the counter's whole budget. Nothing is left for the four corners, and with those empty the corner numbers rule out two more tiles — six safe tiles at once, after which every number points straight at its pod.",
    hint: "The counter says 4 pods. Count how many the side numbers need — is anything left over for the corners?",
    mechanics: [COUNTER, FULL, CLEAR],
    rows: ["#*###", "#...#", "#...*", "*...#", "###*#"] } },
  { chapter: 4, level: {
    title: "Last Pod Standing", role: "practise",
    intent: "Practises the counter at the end of a solve where logic leaves two possible answers, one with fewer pods than the other.",
    aha: "Singles and a 1-2 leave three top tiles with two answers: one pod in the middle, or two pods at the ends. The counter shows one pod left, so it's the middle one and both ends are safe.",
    mechanics: [COUNTER, PAIR12, FULL, CLEAR],
    rows: ["##*#*#", "*...*#", ".....*", "......", "......", "*#*..."] } },
  { chapter: 4, level: {
    title: "Seed Store", role: "practise",
    intent: "Practises the counter on tiles no number can ever see: a pocket sealed behind a wall of pods.",
    aha: "The three bottom-left tiles sit behind a wall of four pods, so no number will ever touch them. Once every other pod is found the counter reads 0, and they're safe.",
    mechanics: [COUNTER, FULL, CLEAR, CHAINED],
    rows: ["*#*...", "###...", "###...", "####*.", "****..", "###*.."] } },
  { chapter: 4, level: {
    title: "The Attic", role: "twist",
    intent: "Twist: the counter doesn't just settle a last tile — it clears a whole region in one go, mid-solve.",
    aha: "With the side pods found, the counter shows 2 left, and the two 3s in row 3 each need one of them in row 2. That uses up both, so the entire top row — six tiles no number touches — is safe.",
    mechanics: [COUNTER, FULL, CLEAR],
    rows: ["######", "##*##*", "*...*#", "*...*#", "*.....", "#....."] } },
  { chapter: 4, level: {
    title: "Crowded Bed", role: "combine",
    intent: "Combines dense big numbers (4s and 3s) with a counter finish in a tight corner.",
    aha: "The 4s and 3s fall to full-number reads until the top-left 2x2 corner, where the numbers allow two layouts. The counter (one pod left) picks the single pod in the inner corner.",
    mechanics: [COUNTER, FULL, CLEAR],
    rows: ["##*...", "#*....", "*#**..", "##....", "##**..", "##...*"] } },
  { chapter: 4, level: {
    title: "Counting Garden", role: "finale",
    intent: "Chapter 4 boss: a full-size field mixing everything so far. Here the counter decides a corner mid-solve, not at the end, and that unlocks the rest.",
    aha: "Singles across the top, a 1-2 down the left 2-column, then a stall in the bottom-left. Count the pods: only the layout that leaves row 7, column 1 empty fits the counter, and opening it lets singles finish.",
    mechanics: [COUNTER, PAIR12, FULL, CLEAR, CHAINED],
    rows: ["##*####", "##...*#", "**.....", "#*.....", "##.....", "**#*...", "#*#**.."] } },

  // ───────────── Chapter 5 · Night Sky — three numbers at once
  { chapter: 5, level: {
    title: "What If?", role: "teach",
    intent: "Teaches reading three numbers together on a small board. A familiar 1-2 along the bottom gets you started, then the top stalls — no single number or pair helps there, but three of them together do.",
    aha: "After the bottom 1-2, the 2 at the top right still sees five covered tiles. The 1 beside it owns one pod among two of them, and the 1 below owns one among two others — that's already both of the 2's pods, so its fifth tile (top middle) is safe.",
    hint: "Look at the 2 on the right: the two 1s next to it each own one of its pods. Which of its tiles is left over?",
    mechanics: [NEST, PAIR12, PAIR11, FULL],
    rows: ["*###*", "###..", "*.*..", ".....", "#*#*#"] } },
  { chapter: 5, level: {
    title: "Star Pair", role: "practise",
    intent: "Practises the three-number read inside a normal solve: it has to be spotted on a frontier where pairs and singles have run dry.",
    aha: "At the top, the 2-2 pair with the 1 under them only fits one way: the pod goes on the right of the group (row 1, column 5) and the far-left tile is safe. After that, singles and one 1-1 finish the left wall.",
    mechanics: [NEST, PAIR11, FULL, CLEAR],
    rows: ["###**#", "##...*", "**....", "##....", "*#....", "#*#*.."] } },
  { chapter: 5, level: {
    title: "Little Dipper", role: "practise",
    intent: "Practises the nested read late in a solve, after a long single-number warm-up — the player has to notice the moment the easy logic stops.",
    aha: "Once the right side is cleared, the 2 in row 2, column 5 sees five tiles. The 2 to its left and the 3 below it each need exactly one pod among two of those tiles, so the corner tile (row 1, column 6) is safe.",
    mechanics: [NEST, PAIR11, FULL, CLEAR, CHAINED],
    rows: ["#**#*#", "....#*", "....##", "....**", "...*##", "..*###"] } },
  { chapter: 5, level: {
    title: "Twin Corners", role: "twist",
    intent: "Twist: the three-number read at a corner of the opening, where a 2 that sees five tiles is boxed in by a 2 beside it and a 2 below it — and it happens in both top corners at once.",
    aha: "In each top corner of the opening, the corner 2 shares tiles with the 2 next to it and the 2 below it. The only way all three are satisfied puts pods in the middle of row 2 and on the sides of row 5, and leaves the outer corners safe — four pods and four safe tiles in one read.",
    mechanics: [CORNER, PAIR12, FULL, CHAINED],
    rows: ["######", "##**##", "*....#", "#....*", "*....*", "**...#", "###**#"] } },
  { chapter: 5, level: {
    title: "Island Pod", role: "combine",
    intent: "Combines the nested read with a mid-game position: a pod already ringed by open numbers changes what every number around it needs.",
    aha: "Subtract the island pod (row 3, column 4) and the found pods from the 2s. The 2 in row 2, column 2 is then left needing two of five tiles, which the 2 beside it and the 1 below it fully cover — so the top-left corner is safe.",
    mechanics: [NEST, REDUCED, PAIR11, FULL],
    rows: ["##*##*", "##....", "*#.*..", "#...**", "#.....", "*...**"] } },
  { chapter: 5, level: {
    title: "Constellation", role: "finale",
    intent: "Chapter 5 boss: a ring of 2s where nothing moves until you see the corner proof — then a long single-number chain all the way around.",
    aha: "Both left corners of the opening are corner proofs: the corner 2 with its neighbours in row 2 and column 2. That places three pods and opens both outer corners, and every other tile then falls to full or satisfied numbers in one long chain.",
    mechanics: [CORNER, FULL, CLEAR, CHAINED],
    rows: ["##**#*#", "#.....#", "*.....*", "*.....#", "#...**#", "*...###", "#*#**##"] } },

  // ───────────── Chapter 6 · Moonlit Meadow — everything, together
  { chapter: 6, level: {
    title: "Moonrise", role: "breather",
    intent: "Breather after the chapter 5 boss: six pods are obvious from the start, a relaxed walk along the top row, and one easy counter call down the right edge.",
    aha: "Flag the six obvious pods (two islands in the opening, two in the middle, two at the bottom), then walk the top row left to right with single numbers. The right column could hide its last two pods in more than one way — the counter (2 left) fits only one, which makes the top, middle and bottom of that column safe.",
    mechanics: [COUNTER, FULL, CLEAR, CHAINED],
    rows: ["####*#", ".**..*", ".....#", ".....#", "..*..*", "..*..#", "...**#"] } },
  { chapter: 6, level: {
    title: "Night Garden", role: "practise",
    intent: "Practises every advanced read in one compact solve — a 1-1, a nested three-number read and a counter finish — each needed exactly once.",
    aha: "The walls go quickly. A 1-1 clears the bottom-middle tile; then the nested read (the 2 in row 6, column 3 is covered by the 2 above it and the 1 beside it) clears row 7, column 2. With that open, the counter settles the last six tiles at once.",
    mechanics: [NEST, PAIR11, COUNTER, FULL, CLEAR],
    rows: ["*.....#", "*.....*", "*.....*", "*#*...*", "#*#...*", "###...#", "##*##*#"] } },
  { chapter: 6, level: {
    title: "Lily Pond", role: "combine",
    intent: "Combines a dense opening — a pond of nine pods visible at once, with numbers all around it — with a 1-1 down the right edge and a counter call for a tile no number can ever see.",
    aha: "Flag the pond first: the 3s, 4 and 5 around it are all full. Then work down the right side, where a 1-1 read clears four edge tiles at once. The last top-right tile is walled in by pods on every side — only the counter (no pods left) proves it safe.",
    mechanics: [PAIR11, COUNTER, FULL, CLEAR, CHAINED],
    rows: [".**..*#", ".....**", ".....##", "...*.*#", "..**.##", "...**##", "...*.#*"] } },
  { chapter: 6, level: {
    title: "Firefly Row", role: "twist",
    intent: "Twist: a pair read that settles a whole row of six alternating tiles in one go, then a corner proof in the top-right.",
    aha: "The bottom row under 1-1-2-1-4 can only alternate — safe, pod, safe, pod, safe, pod — and the pair reads prove all six tiles at once. Then the top-right 2 seeing five tiles is boxed in by the 2 beside it and the 2 below it: its far corner is safe.",
    mechanics: [CORNER, PAIR12, PAIR11, FULL, CHAINED],
    rows: ["#*#**##", "*#*...#", "......*", "......*", ".....*#", ".....*#", "#*#*#*#"] } },
  { chapter: 6, level: {
    title: "Meadow Edge", role: "combine",
    intent: "Combines a dense opening (eight pods visible at once) with a 1-2 down the right edge and a counter call mid-column.",
    aha: "Flag the eight obvious pods and the bottom and left open up. On the right edge a 1-2 places the row-4 pod, then the counter shows exactly one pod left for two edge tiles — and only row 2 fits, so row 3 is safe.",
    mechanics: [PAIR12, COUNTER, FULL, CLEAR, CHAINED],
    rows: ["....###", "....***", ".....*#", "*....**", "#....#*", "#....##", "#***#*#"] } },
  { chapter: 6, level: {
    title: "Moonlit Meadow", role: "finale",
    intent: "Final boss: a real mid-game field with three covered rows on top. It needs every technique in the game, in order — singles, a pair, a three-number proof and the counter.",
    aha: "Dense singles clear the middle. A pair read opens the top-left, then the 3-3-3 cluster on the right only fits with a pod at row 2, column 7 — and once it's placed the counter shows no pods left for the top-right corner, so all three tiles there are safe.",
    mechanics: [NEST, PAIR12, COUNTER, FULL, CLEAR, CHAINED],
    rows: ["#*#*###", "###**#*", "###*###", "#.....*", "*.*..**", "..*.*..", ".......", "....*.."] } },
];
