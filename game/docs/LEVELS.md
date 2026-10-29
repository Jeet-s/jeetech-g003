# Cozy Fields — campaign level plan

The campaign is **36 hand-picked no-guess minesweeper puzzles** in 6 chapters. Every level is a real
minesweeper position with its opening already uncovered. The player must clear every safe tile using logic
alone: the numbers on screen plus the pod counter. Classic rules apply. Tapping a seed pod ends the
run, the board stays on screen for review, and one free Undo can take that tap back.

The free-play modes (Beginner → Expert, Daily, Custom) use the same engine with a seeded no-guess
generator: first tap always safe, re-rolled until the solver clears it.

## How a puzzle is judged

`src/game/solver.ts` is a logical solver that only uses what the player sees. It labels every deduction
with the technique it needed. **That technique ladder is the mechanic ladder of the campaign:**

| Tier | Technique | What the player learns |
|---|---|---|
| 1 single | **full number** — a number touching exactly as many covered tiles as its count: all pods. **satisfied number** — its pods are found: every other tile around it is safe | Ch 1 |
| 2 pair | **1-1** — one number's covered tiles sit inside its neighbour's, so the leftover tiles are safe. **reduced number** — subtract the pods you've already found | Ch 2 |
| 2 pair | **1-2** — the bigger number needs a pod the smaller one can't share, so it sits where only the bigger reaches | Ch 3 |
| 4 count | **pod counter** — the number of pods left in the whole field decides between layouts, or clears tiles no number touches | Ch 4 |
| 3 chain | **three-number proof** — two small needs nested inside one bigger number, or the **corner proof** (a 2 seeing five tiles, boxed in by two neighbouring 2s) | Ch 5 |
| all | everything together, on bigger, denser fields | Ch 6 |

The counter (tier 4) is taught before the three-number proofs (tier 3). It is the easier idea ("one pod
left → it's the middle one"), and the harder idea gets the dark Night Sky chapter.

Every level is checked by `npm run validate`. It must need its chapter's technique (it cannot be solved
with the earlier ones), every solver deduction is replayed as real moves on the engine to a win, no start
position repeats, and no row or column is empty filler.

## Pacing

- **Chapter shape:** teach → practise → practise/twist → twist → combine → **finale (boss)**. The next
  chapter's small teach board is the breather after each boss. Ch 6 opens with a dedicated breather.
- **Bot playtest:** the factory's human-like bots never tap a pod they've already spotted with the
  single-number rule. Their slips land on tiles only deeper logic could clear, so levels whose key
  pods need pairs, chains or the counter are the ones where hasty players fail.
- **Target first-try casual win rate:** about 100% (tutorial) → 75-90% (Ch 2) → 60-75% (Ch 3-4) →
  40-60% (Ch 5) → 30-45% (Ch 6). Each boss sits 10-20 points below its chapter, and each breather 10-25
  points above the boss.
- **Guided tutorial (levels 1-2):** the next certain move glows on the board, and a bubble in the strip
  just above the tray (pointing at the tile's column, never covering a number; it reflows onto two lines
  on narrow phones) names the action and its reason using the on-screen controls only ("The numbers say
  this hides a pod — switch to Flag up top" → the pointer taps the Flag toggle; then "Tap to plant a flag
  on the pod" / "Safe — tap to reveal"). The pointer retires after the first flag; the coach card (hidden
  on small phones, where the bubble carries the lesson) fades out 0.4 s after the field is cleared. A tap that the numbers rule
  out (revealing a pod, flagging a safe tile) shakes and explains instead of ending the run or skewing
  the pod counter; once every pod is flagged the tool switches back to Reveal on its own.
- **Difficulty number** (validate): deduction rounds weighted by technique (single 1, pair 3,
  counter 8, chain 10) × (1 + covered tiles / 8). The last third averages over 3× the first third.

`scripts/tune-levels.ts` reports every level's **true** expected win rate (many trials, sound RNG)
against the gates; a board outside its band gets redesigned. The script never edits a board.

## Chapters and levels

Role · the insight the player must find · why the level sits where it does.

### Chapter 1 · First Sprouts (paper) — the number rule
Mechanic arc: teach both halves of the rule separately (L1 full number, L2 satisfied number), practise
chaining them (L3-L4), twist (L5: the big numbers are where the safe tiles come from), finale (L6: a
seven-link chain around a ring).

1. **Two Sprouts** · teach · the top 2 touches exactly two covered tiles, so both are pods, and then every other tile is safe · smallest field that needs both actions, flag and reveal.
2. **Corner Seeds** · teach · a 1 touching one covered tile marks the pod, and the 1 above is then full, so its corner is safe; the second corner is mirrored · isolates the "satisfied → safe" half and repeats it once.
3. **Follow the Thread** · practise · the left wall's 2s pin the top pods, and each opened tile points to the next · first level where a reveal creates the clue you need.
4. **Garden Corner** · practise · two 2s pin four pods, the 3 becomes full, and a covered block falls from its edge · shows a big block is solved from the outside in.
5. **Full Hands** · twist · the 4s each see five tiles and decide nothing until the small numbers hand them their pods, after which their fifth tile is safe · flips "big number = scary" before the boss.
6. **Ring of Seeds** · finale · find the side where the chain starts (right), then go round the ring · chapter test: long, branching, single-rule only.

### Chapter 2 · Garden Wall (garden) — compare two numbers: the 1-1
Arc: teach the 1-1 on a tiny wall (L7), practise it at the end of a solve (L8) and with a reduced
number (L9), twist it vertically and repeated (L10), combine it with chapter 1 (L11), finale (L12).

7. **Wall Twins** · teach / breather · the two 1s on the right edge share a pod, so the upper 1's extra tile is safe · first level no single number can start alone.
8. **Garden Path** · practise · after the left wall, a corner 1-1 clears two bottom tiles · the new idea placed at the end of a familiar solve.
9. **Hedge Corner** · practise · a 2 with one found pod beside it is a 1 in disguise, and with the corner 1 it makes a 1-1 · introduces the reduced number.
10. **Long Wall** · twist · a column of 1s faces a two-wide strip, and the 1-1 zips down it four times before any pod appears · the pair idea repeated and turned sideways.
11. **Two Fronts** · combine · the right pocket is pure single numbers; the left strip needs two 1-1 reads · tests choosing the right tool per area.
12. **Bramble Box** · finale · shrink the 2s with found pods, then three separate 1-1 reads open the bottom row · longest solve so far.

### Chapter 3 · Hedge Rows (garden) — the 1-2 family
Arc: teach the 1-2 against a wall (L13), practise it with a big number in disguise (L14) and inside a
longer line (L15), twist (L16: pair logic as a tool to build clues two rows deep), combine 1-2 with 1-1
(L17), finale (L18).

13. **One-Two** · teach / breather · the 2 needs a pod the 1 beside it can't share, so it's on the tile only the 2 touches · the second pair idea, alone on a small board.
14. **Two-Step** · practise · a 3 with one found pod acts as a 2 beside a 1, and the right side then needs 1-1 reads · forces choosing between the two pair ideas.
15. **Bent Row** · practise · the 1-2 hidden in a 2-1-3 line, then a closing 1-1 · the pattern among noise, not on a clean wall.
16. **Deep Pocket** · twist · the numbers only touch the first of two covered rows; pair reads open row one, whose new numbers solve row two · pair logic used to make clues, not just to find pods.
17. **Thornbush** · combine · one 1-2 places the corner pod and unlocks three 1-1 reads down the right column · the two pair ideas chained.
18. **Hedge Maze** · finale · two 1-2s open the field; the bottom row, untouched by any number at the start, unzips with 1-1s · chapter test.

### Chapter 4 · Seed Counter (paper) — the counter is a clue
Arc: teach (L19: the counter rules out layouts), practise as an endgame decider (L20) and for a sealed
pocket (L21), twist (L22: the counter clears a whole region mid-solve), combine with dense numbers
(L23), finale (L24: the counter decides mid-solve and unlocks the rest).

19. **Four Seeds** · teach / breather · four sides each need their own pod, which is the counter's whole budget, so the corners are safe · nothing else can make the first move.
20. **Last Pod Standing** · practise · the top row could hold one pod or two, and the counter shows one · the classic endgame use.
21. **Seed Store** · practise · three tiles sealed behind a wall of pods are safe once the counter hits 0 · tiles no number will ever see.
22. **The Attic** · twist · the two remaining pods are both needed in row 2, so the whole top row is safe · the counter clears a region mid-solve.
23. **Crowded Bed** · combine · dense 4s and 3s, then the counter picks the inner corner · combines with big-number reading.
24. **Counting Garden** · finale · singles, a 1-2, then a mid-solve counter call in the bottom-left that unlocks the end · chapter test on a full 7×7.

### Chapter 5 · Night Sky (night) — three numbers at once
Arc: teach the nested proof (L25), practise it in a normal solve (L26) and late in a solve (L27), twist
(L28: the corner proof, in both corners at once), combine with an island pod (L29), finale (L30:
double corner proof).

25. **What If?** · teach / breather · a 1-2 starts it; then two 1s each own one of the top-right 2's pods, so its fifth tile is safe · small board, one new idea.
26. **Star Pair** · practise · the 2-2-1 group fits only one way: the right tile is a pod, the far left is safe · spotting the stall on a normal frontier.
27. **Little Dipper** · practise · after a long single-number warm-up, the nested read clears the top-right corner · noticing when the easy logic stops.
28. **Twin Corners** · twist · in each top corner the 2 seeing five tiles is boxed in by two 2s, giving four pods and four safe tiles in one read · the proof turned into a corner shape.
29. **Island Pod** · combine · subtract the island pod and found pods, then the nested read clears the top-left · combines with the reduced number.
30. **Constellation** · finale · two corner proofs start a long chain round a ring of 2s · chapter test; hardest level so far.

### Chapter 6 · Moonlit Meadow (night) — everything together
Arc: breather (L31), practise all advanced reads once each (L32), combine (L33, L35), twist (L34: a
six-tile alternating row in one read, then a corner proof), finale (L36: every technique, in order).

31. **Moonrise** · breather · six obvious pods, a walk along the top, and an easy counter call down the right edge · rest after the hardest boss.
32. **Night Garden** · practise · a 1-1, a nested proof and a counter finish, each needed exactly once · a checklist of everything.
33. **Lily Pond** · combine · flag a pond of nine visible pods, a 1-1 clears the right edge, and a tile walled in by pods falls to the counter · dense opening plus the counter's strangest use.
34. **Firefly Row** · twist · the bottom row alternates safe-pod-safe-pod-safe-pod, proved in one read; then a corner proof top-right · familiar ideas at a bigger scale.
35. **Meadow Edge** · combine · eight pods visible at once, a 1-2 on the right edge, and a counter call mid-column · dense opening with late logic.
36. **Moonlit Meadow** · finale · a real mid-game field with three covered rows; singles, a pair, a three-number proof and the counter, in that order · the final test.

## Tools

- `npx tsx scripts/design.ts [a b]` — every level as the player sees it, with solver facts, the weakest technique that clears it, the shortest tap count and expected bot win rates (`STEPS=1` adds the deduction trace and names the numbers behind each three-number proof).
- `npx tsx scripts/propose.ts w=6 h=6 pods=8 tier=3 …` — deals candidate positions that require a technique (designer's raw material, never auto-kept).
- `npx tsx scripts/tune-levels.ts` — true vs measured pacing against the QA gates; writes `src/game/pacing.json`.
- `npm run validate`, `npm run playtest`, `npm run levels` — the factory's gates.
