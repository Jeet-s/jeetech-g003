import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View, useWindowDimensions, Pressable } from "react-native";
import Animated, { cancelAnimation, FadeIn, FadeInDown, useAnimatedStyle, withRepeat, useSharedValue, withSequence, withSpring, withTiming, withDelay, Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AnimatedNumber, ArtPanel, Background, Confetti, LeafConfetti, StarGlyph, Stars, FailPopup, FloatingText, GameButton, Icon, IconButton, Leaf, Panel, Popup, Sprite, TopBar, TutorialHand, WinPopup,
  POD_CROP, feedback, fonts, haptic, palette, play, springs, useShake, type FailAction,
} from "../ui";
import { BoardView, TRAY_PAD, type HintMark } from "./Board";
import { CHAPTERS, LEVELS, levelBoard } from "../game/levels";
import { chord, hint as findHint, podsRemaining, reveal, revive, toggleFlag, undo, type GameState } from "../game/engine";
import { solve } from "../game/solver";
import {
  HINT_CAP, HINT_LEAVES, REVIVE_LEAVES, fmtTime, recordLoss, recordWin, startState, themeOf, type Session, type WinResult,
} from "../game/session";
import { store } from "../modules/store";
import { ads } from "../modules/ads";
import { analytics } from "../modules/analytics";
import { qa, reportNext } from "../modules/qa";
import { useBannerHeight } from "../modules/layout";

/** Screenshot mode: play the first `steps` solver deductions on mount, optionally finish + show the win card. */
export interface Demo { steps: number; win?: boolean; secs?: number; live?: boolean }

type Tool = "reveal" | "flag";

/** Running clock that only re-renders itself. */
function Clock({ get }: { get: () => number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  return <Text style={styles.clock}>{fmtTime(get())}</Text>;
}

/**
 * 3★ pace meter: a honey bar that fills on level start, then drains toward the current star limit;
 * when a star is lost it pops off and the bar refills for the next window (2★), so the goal is never static.
 */
function StarMeter({ get, times, capped }: { get: () => number; times: [number, number]; capped: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);
  const e = get();
  const stars = e <= times[0] && !capped ? 3 : e <= times[1] ? 2 : 1;
  const frac = stars === 3 ? 1 - e / times[0] : stars === 2 ? 1 - Math.max(0, e - (capped ? 0 : times[0])) / (times[1] - (capped ? 0 : times[0])) : 0;
  const fill = useSharedValue(0);
  const pop = useSharedValue(1);
  const prevStars = useRef(stars);
  useEffect(() => {
    if (prevStars.current !== stars) {
      prevStars.current = stars;
      pop.value = withSequence(withTiming(1.35, { duration: 90 }), withSpring(1, springs.pop));
      fill.value = withTiming(Math.max(0, Math.min(1, frac)), { duration: 420, easing: Easing.out(Easing.cubic) });
    } else fill.value = withTiming(Math.max(0, Math.min(1, frac)), { duration: fill.value === 0 && frac > 0.5 ? 600 : 250, easing: fill.value === 0 ? Easing.out(Easing.cubic) : Easing.linear });
  }, [frac, stars, fill, pop]);
  const fillSt = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const popSt = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const limit = stars === 3 ? times[0] : times[1];
  return (
    <View style={styles.meter}>
      <Animated.View style={[styles.meterStars, popSt]}>
        {[0, 1, 2].map((k) => <StarGlyph key={k} size={13} on={k < stars} />)}
      </Animated.View>
      <View style={styles.meterTrack}>
        <Animated.View style={[styles.meterFill, stars === 3 ? null : styles.meterFill2, fillSt]} />
        <Text style={styles.meterText} numberOfLines={1}>{stars > 1 ? `under ${fmtTime(limit)}` : "cleared counts!"}</Text>
      </View>
    </View>
  );
}

/** Pods-left count: a 200 ms pulse with a soft sage halo whenever a flag lands (or lifts). */
function PodCount({ value }: { value: number }) {
  const s = useSharedValue(1);
  const halo = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    s.value = withSequence(withTiming(1.32, { duration: 80, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 120, easing: Easing.out(Easing.back(2)) }));
    halo.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 320 }));
  }, [value, s, halo]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const haloSt = useAnimatedStyle(() => ({ opacity: halo.value * 0.85, transform: [{ scale: 0.7 + halo.value * 0.5 }] }));
  return (
    <View style={styles.podCountBox}>
      <Animated.View pointerEvents="none" style={[styles.podHalo, haloSt]} />
      <Animated.Text style={[styles.podCount, st]}>{Math.max(0, value)}</Animated.Text>
    </View>
  );
}

/**
 * Reveal / Flag tool switch in the HUD. The thumb slides (120 ms, elastic overshoot) to the active tool and
 * the whole switch swells to 1.05 under the finger; the
 * idle side is greyed out; while Flag is on the pill turns accent red and the switch breathes a warm glow,
 * so the mode can't be missed.
 */
function ToolSwitch({ tool, onChange, flagRef, onLayout }: { tool: Tool; onChange: (t: Tool) => void; flagRef?: RefObject<ComponentRef<typeof View> | null>; onLayout?: () => void }) {
  const x = useSharedValue(tool === "flag" ? 1 : 0);
  const breathe = useSharedValue(0);
  const press = useSharedValue(1);
  const thumb = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    x.value = withTiming(tool === "flag" ? 1 : 0, { duration: 120, easing: Easing.out(Easing.back(2.6)) });
    if (first.current) first.current = false;
    else thumb.value = withSequence(withTiming(1.12, { duration: 60, easing: Easing.out(Easing.quad) }), withSpring(1, springs.pop));
    breathe.value = tool === "flag"
      ? withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.sin) })), -1)
      : withTiming(0, { duration: 200 });
  }, [tool, x, breathe]);
  useEffect(() => () => cancelAnimation(breathe), [breathe]);
  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 62 }, { scaleX: thumb.value }, { scaleY: 2 - thumb.value }],
    backgroundColor: x.value > 0.5 ? "#C9533F" : palette.sageDark,
    borderColor: x.value > 0.5 ? "#FFB3A4" : "#B9D49A",
    shadowColor: x.value > 0.5 ? "#FF8A73" : "#B9E08A",
  }));
  const glow = useAnimatedStyle(() => ({ opacity: breathe.value }));
  const pressSt = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Animated.View style={[styles.tool, pressSt]} onLayout={onLayout}>
      <Animated.View pointerEvents="none" style={[styles.toolBreath, glow]} />
      <Animated.View style={[styles.toolPill, pill]} />
      {(["reveal", "flag"] as Tool[]).map((t) => (
        <Pressable
          key={t}
          ref={t === "flag" ? flagRef : undefined}
          style={styles.toolItem}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityState={{ selected: tool === t }}
          onPressIn={() => (press.value = withTiming(1.05, { duration: 70, easing: Easing.out(Easing.quad) }))}
          onPressOut={() => (press.value = withSpring(1, springs.pop))}
          onPress={() => {
            feedback("tap", "select");
            onChange(t);
          }}
        >
          <View style={tool === t ? styles.toolGlow : styles.toolIdle} pointerEvents="none">
            {t === "flag" ? <Sprite id="tile_flag_fabric" width={tool === t ? 17 : 14} /> : <Icon name="tap" size={tool === t ? 18 : 16} color={tool === t ? "#FFFBF0" : palette.brown} engraved={false} />}
          </View>
          <Text style={[styles.toolText, tool === t ? styles.toolTextOn : styles.toolTextOff]}>{t === "reveal" ? "Reveal" : "Flag"}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

/** Opens the first `steps` solver deductions of a level (flags its pods) — screenshot states. */
function playSteps(g: GameState, steps: number): GameState {
  let s = g;
  if (!s.board) s = reveal(s, Math.floor(s.h / 2) * s.w + Math.floor(s.w / 2)); // classic: the safe first tap
  if (!s.board) return s;
  const r = solve(s.board, s.open, 4);
  for (const st of r.steps.slice(0, steps)) {
    for (const p of st.pods) if (!s.flag[p]) s = toggleFlag(s, p);
    for (const c of st.safe) if (!s.open[c]) s = reveal(s, c);
  }
  return { ...s, prev: null, taps: s.taps };
}

/** One board: HUD (pods left, clock, tool), the tray, hint / undo / restart, review → win / fail flow. */
export function GameScreen({ session, onExit, onSettings, onNextLevel, onFreePlay, demo }: {
  session: Session;
  onExit: () => void;
  onSettings: () => void;
  onNextLevel: (n: number) => void;
  onFreePlay?: () => void;
  demo?: Demo;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 720; // small phones (e.g. 720x1280 @ 320dpi = 360x640 dp): tighter chrome, more board
  const bannerH = useBannerHeight();
  const isLevel = session.kind === "level";
  const level = isLevel ? LEVELS[session.level - 1] : null;
  const facts = isLevel ? levelBoard(session.level - 1).facts : null;
  const theme = useMemo(() => themeOf(session), [session]);
  const [prefs, setPrefs] = useState(store.get());
  useEffect(() => store.subscribe(setPrefs), []);

  const [g, setG] = useState<GameState>(() => {
    const s0 = startState(session);
    return demo ? playSteps(s0, demo.steps) : s0;
  });
  const [tool, setTool] = useState<Tool>("reveal");
  const [delays, setDelays] = useState<Map<number, number>>(new Map());
  const [hintMark, setHintMark] = useState<{ cell: number; mark: HintMark } | null>(null);
  const [phase, setPhase] = useState<"play" | "review" | "won" | "lost">("play");
  const [win, setWin] = useState<WinResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [hintAsk, setHintAsk] = useState(false);
  const [revived, setRevived] = useState(false);
  const [floater, setFloater] = useState<{ key: number; text: string; color?: string; x?: number; y?: number } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [cheer, setCheer] = useState<{ stars: number; leaves: number } | null>(null); // on-board win moment
  const [ripple, setRipple] = useState<{ key: number; x: number; y: number } | null>(null);
  const [area, setArea] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [sparkle, setSparkle] = useState<{ key: number; x: number; y: number } | null>(null);
  const { style: shakeStyle, shake } = useShake(8);
  const dim = useSharedValue(0);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const vignette = useSharedValue(0);
  const vignetteStyle = useAnimatedStyle(() => ({ opacity: vignette.value }));
  const winGlow = useSharedValue(0); // warm golden halo around the tray as the field clears
  const winGlowStyle = useAnimatedStyle(() => ({ opacity: winGlow.value, transform: [{ scale: 0.96 + winGlow.value * 0.06 }] }));
  // Pause / hint card: the field eases back (soft zoom + fade) so the card owns the focus.
  const away = useSharedValue(0);
  const awaySt = useAnimatedStyle(() => ({ opacity: 1 - away.value * 0.25, transform: [{ scale: 1 - away.value * 0.05 }] }));
  const [round, setRound] = useState(0); // bumps on restart so the board eases back in instead of cutting
  // Board entrance on a stable view (a keyed `entering` remount can stick blank on Android): rises from 12 dp
  // and 40 % opacity on open, a soft 200 ms fade on restart.
  const boardIn = useSharedValue(0);
  useEffect(() => {
    boardIn.value = 0;
    boardIn.value = withTiming(1, { duration: round ? 200 : 220, easing: Easing.out(Easing.cubic) });
  }, [round, boardIn]);
  const boardInSt = useAnimatedStyle(() => ({ opacity: 0.4 + boardIn.value * 0.6, transform: [{ translateY: (1 - boardIn.value) * (round ? 0 : 12) }] }));
  // Levels 1-2 are the guided tutorial: the hand shows each step and wrong moves are coached, never fatal.
  const tutorial = isLevel && session.level <= 2 && !demo;
  // QA level replay (<scheme>://qa/level/<n>): this screen reports the solver's next tap after every move.
  const qaMode = isLevel && !demo && qa.level === session.level;
  useEffect(() => {
    away.value = withTiming(paused || hintAsk ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [paused, hintAsk, away]);

  // Clock: runs while playing; paused by the pause card and stopped at the end.
  const clock = useRef({ acc: (demo?.secs ?? 0) * 1000, since: 0 as number | 0 });
  const running = phase === "play" && !paused && g.status === "playing";
  useEffect(() => {
    const c = clock.current;
    if (running) c.since = Date.now();
    else if (c.since) {
      c.acc += Date.now() - c.since;
      c.since = 0;
    }
  }, [running]);
  const elapsed = useCallback(() => (clock.current.acc + (clock.current.since ? Date.now() - clock.current.since : 0)) / 1000, []);

  useEffect(() => {
    if (isLevel) analytics.track("level_start", { level: session.level });
    else analytics.track("mode_selected", { mode: session.mode.id, rows: session.mode.h, cols: session.mode.w, daily: session.daily !== undefined });
    if (demo?.win) {
      const full = playSteps(g, 999);
      later(() => {
        setG(full);
        finishWin(full, demo.secs ?? 30, !demo.live);
      }, demo.live ? 1500 : 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- board sizing
  const big = !!prefs.bigCells && !isLevel;
  const minCell = big ? 46 : 34;
  const fitW = Math.floor((Math.min(area.w, 640) - 16 - TRAY_PAD * 2) / g.w);
  // Tutorial boards keep a strip free above and below the tray for the coaching bubble, so it never sits on numbers.
  const bubbleRoom = tutorial ? 2 * 56 : 0;
  const fitH = Math.floor((area.h - 12 - TRAY_PAD * 2 - bubbleRoom) / g.h);
  const cell = Math.max(minCell, Math.min(isLevel ? 74 : 60, fitW, fitH));
  const boardW = g.w * cell + TRAY_PAD * 2;
  const boardH = g.h * cell + TRAY_PAD * 2;
  const scrolls = boardW > area.w || boardH > area.h;
  const origin = { x: area.x + Math.max(0, (area.w - boardW) / 2) + TRAY_PAD, y: area.y + Math.max(0, (area.h - boardH) / 2) + TRAY_PAD };

  // ---------------------------------------------------------------- actions
  const gRef = useRef(g);
  gRef.current = g;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every delayed beat of this screen (win sequence, demo) is tracked and cleared on restart / unmount.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  }, []);
  const clearLater = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => () => { if (reviewTimer.current) clearTimeout(reviewTimer.current); clearLater(); }, [clearLater]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  function finishWin(next: GameState, secs: number, quiet = false) {
    setPhase("won");
    const res = recordWin(session, next, secs);
    if (isLevel) {
      analytics.track("level_complete", { level: session.level, stars: res.stars ?? 0 });
      if (session.level === 2 && !store.get().tutorialDone) {
        store.set({ tutorialDone: true });
        analytics.track("tutorial_done");
      }
    } else analytics.track("game_win", { mode: session.mode.id, time_ms: Math.round(secs * 1000), mistakes: next.mistakes });
    // The win lands on the winning tap itself: the golden clearing wave sweeps the board (sprouting every pod's
    // flag), confetti + a leaf shower burst, the board glows and the "Field Cleared!" ribbon springs in with the
    // stars filling and the leaves counting up. The result card then slides in and stays.
    if (quiet) setWin(res);
    else {
      feedback("success", "success");
      setCheer({ stars: res.stars ?? 0, leaves: res.leaves });
      setConfetti((c) => c + 1);
      winGlow.value = withSequence(withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }), withDelay(500, withTiming(0.35, { duration: 700 })));
      later(() => setConfetti((c) => c + 1), 650);
      later(() => setWin(res), 1300);
    }
  }

  function apply(next: GameState, at: number) {
    const prev = gRef.current;
    if (next === prev) return;
    // Ripple delays for every tile this action opened, by distance from the tapped tile.
    const d = new Map<number, number>();
    let opened = 0;
    const ar = Math.floor(at / next.w), ac = at % next.w;
    next.open.forEach((o, i) => {
      if (o && !prev.open[i]) {
        opened++;
        const dist = Math.max(Math.abs(Math.floor(i / next.w) - ar), Math.abs((i % next.w) - ac));
        d.set(i, Math.min(qaMode ? 150 : 900, dist * (qaMode ? 15 : 60))); // cascade wave: 60 ms per ring out from the tap (quick in QA replay)
      }
    });
    setDelays(d);
    setHintMark(null);
    setG(next);
    analytics.qa("move", { level: isLevel ? session.level : 0 });
    const tapX = origin.x + ac * cell + cell / 2, tapY = origin.y + ar * cell + cell / 2;
    if (next.status === "lost") {
      // Every hidden pod (and any wrong flag) surfaces in a ripple spreading out from the burst.
      next.board?.pod.forEach((p, i) => {
        if ((p && !next.open[i]) || (!p && next.flag[i])) {
          const dist = Math.max(Math.abs(Math.floor(i / next.w) - ar), Math.abs((i % next.w) - ac));
          d.set(i, 250 + Math.min(1400, dist * 90));
        }
      });
      setDelays(new Map(d));
      if (!scrolls) setRipple({ key: Date.now(), x: tapX, y: tapY });
      play("error");
      haptic("heavy");
      shake();
      vignette.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 420 }));
      dim.value = withSequence(withTiming(1, { duration: 500 }), withDelay(2200, withTiming(0.35, { duration: 400 })));
      setPhase("review");
      recordLoss(session);
      if (isLevel) analytics.track("level_fail", { level: session.level });
      else analytics.track("game_loss", { mode: session.mode.id, time_ms: Math.round(elapsed() * 1000) });
      // Board review: the full field + the fatal tile stay on screen for 3 s before any card or ad.
      reviewTimer.current = setTimeout(() => phaseRef.current === "review" && setPhase("lost"), 3000);
      return;
    }
    if (next.mistakes > prev.mistakes && next.status !== "won") {
      // Cozy mode: the pod is flagged for you, the run goes on.
      feedback("error", "warning");
      shake();
      setFloater({ key: Date.now(), text: "Oops — flagged it", color: palette.danger });
    } else if (opened > 6) {
      // A cascade: chime, bloom and the number of fields it opened rising from the tap.
      feedback(opened > 20 ? "star2" : "star1", "medium");
      setSparkle({ key: Date.now(), x: tapX, y: tapY });
      if (next.status !== "won" && !scrolls) setFloater({ key: Date.now(), text: `+${opened}`, x: tapX, y: tapY - cell * 0.4, color: palette.sageDark });
    } else if (opened > 0) feedback("pop", "light");
    else if (next.flag !== prev.flag) feedback("move", "select");
    if (next.status === "won") finishWin(next, elapsed());
  }

  /** Tutorial coaching for a move the numbers rule out: the tile shakes its answer instead of ending the run. */
  function nudge(i: number, text: string) {
    const s = gRef.current;
    feedback("error", "warning");
    shake();
    setHintMark({ cell: i, mark: s.board?.pod[i] ? 2 : 1 });
    if (!scrolls) setFloater({ key: Date.now(), text, x: origin.x + (i % s.w) * cell + cell / 2, y: origin.y + Math.floor(i / s.w) * cell - 6, color: palette.danger });
  }

  const onTap = useCallback((i: number) => {
    const s = gRef.current;
    if (phaseRef.current !== "play" || s.status === "won" || s.status === "lost") return;
    if (tutorial && !s.open[i] && s.board) {
      if (toolRef.current === "flag" && !s.flag[i] && !s.board.pod[i]) return nudge(i, "Safe tile — no flag");
      if (toolRef.current === "reveal" && !s.flag[i] && s.board.pod[i]) return nudge(i, "A pod — use Flag");
    }
    if (s.open[i]) {
      const n = chord(s, i);
      if (n === s) feedback("tap", "select");
      apply(n, i);
      return;
    }
    if (toolRef.current === "flag") {
      apply(toggleFlag(s, i), i);
      return;
    }
    if (s.flag[i]) {
      // Flags guard against misfires: a flagged tile needs the Flag tool (or a hold) to change.
      feedback("tap", "select");
      return;
    }
    if (!s.board) analytics.track("first_tap", { pos: i, time_from_start_ms: Math.round(elapsed() * 1000) });
    apply(reveal(s, i), i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, origin.x, origin.y, scrolls]);

  const onHold = useCallback((i: number) => {
    const s = gRef.current;
    if (phaseRef.current !== "play" || s.status !== "playing") return;
    if (s.open[i]) apply(chord(s, i), i);
    else if (tutorial && s.board && !s.flag[i] && !s.board.pod[i]) nudge(i, "Safe tile — no flag");
    else apply(toggleFlag(s, i), i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, origin.x, origin.y, scrolls]);

  function restart() {
    if (reviewTimer.current) clearTimeout(reviewTimer.current);
    clearLater();
    winGlow.value = withTiming(0, { duration: 200 });
    setG(startState(session));
    setRound((r) => r + 1);
    setDelays(new Map());
    setHintMark(null);
    setPhase("play");
    setWin(null);
    setCheer(null);
    setRevived(false);
    setPaused(false);
    dim.value = withTiming(0, { duration: 250 });
    clock.current = { acc: 0, since: 0 };
    if (isLevel) analytics.track("level_start", { level: session.level });
    else if (session.kind === "free") analytics.track("mode_selected", { mode: session.mode.id, rows: session.mode.h, cols: session.mode.w, daily: session.daily !== undefined });
  }

  function doUndo() {
    const s = gRef.current;
    const n = undo(s);
    if (n === s) return;
    feedback("move", "medium");
    setFloater({ key: Date.now(), text: "Undone", color: palette.sageDark });
    analytics.track("undo_used", { time_ms: Math.round(elapsed() * 1000), remaining_undo: n.undoLeft });
    dim.value = withTiming(0, { duration: 250 });
    setDelays(new Map());
    setHintMark(null);
    setG(n);
    analytics.qa("move", { level: isLevel ? session.level : 0 });
    setPhase("play");
  }

  function giveHint(paid: "free" | "ad" | "leaves") {
    setHintAsk(false);
    const s = gRef.current;
    const h = findHint(s);
    if (!h) return;
    if (paid === "leaves") {
      store.set({ coins: store.get().coins - HINT_LEAVES });
      setFloater({ key: Date.now(), text: `-${HINT_LEAVES} leaves`, color: palette.sageDark });
    }
    analytics.track("hint_requested", { paid, remaining_hints: HINT_CAP - s.hintsUsed - 1 });
    setG({ ...s, hintsUsed: s.hintsUsed + 1 });
    setHintMark({ cell: h.cell, mark: h.pod ? 2 : 1 });
    if (paid !== "leaves" && !scrolls) {
      const hx = origin.x + (h.cell % s.w) * cell + cell / 2, hy = origin.y + Math.floor(h.cell / s.w) * cell;
      setFloater({ key: Date.now(), text: h.pod ? "A pod here" : "Safe here", x: hx, y: hy, color: h.pod ? "#C9861E" : palette.sageDark });
    }
    feedback("unlock", "light");
  }

  function askHint() {
    const s = gRef.current;
    if (!s.board || s.status !== "playing" || s.hintsUsed >= HINT_CAP || !findHint(s)) {
      feedback("error", "warning");
      return;
    }
    if (store.get().adsRemoved) giveHint("free");
    else setHintAsk(true);
  }

  function doRevive(how: "ad" | "leaves" | "free") {
    const apply = () => {
      const s = gRef.current;
      setG(revive(s));
      setRevived(true);
      setFloater({ key: Date.now(), text: "Revived!", color: palette.sageDark });
      setPhase("play");
      dim.value = withTiming(0, { duration: 250 });
      play("unlock");
      haptic("success");
      analytics.track("revive_prompted", { accepted: true, method: how });
    };
    if (how === "leaves") {
      store.set({ coins: store.get().coins - REVIVE_LEAVES });
      apply();
    } else if (how === "ad") ads.showRewarded(apply);
    else apply();
  }

  // ---------------------------------------------------------------- fail card options
  const failActions: FailAction[] = [];
  if (g.undoLeft > 0 && g.prev) failActions.push({ label: "Undo that tap", onPress: doUndo, variant: "primary", sub: <Text style={styles.freeTag}>FREE</Text> });
  if (!revived) {
    if (prefs.adsRemoved) failActions.push({ label: "Revive", onPress: () => doRevive("free"), variant: "light" });
    else if (ads.rewardedAvailable()) failActions.push({ label: "Revive", onPress: () => doRevive("ad"), variant: "light", sub: <Icon name="ad" size={20} /> });
    if (!prefs.adsRemoved && prefs.coins >= REVIVE_LEAVES)
      failActions.push({ label: `Revive · ${REVIVE_LEAVES}`, onPress: () => doRevive("leaves"), variant: "light", sub: <Leaf size={20} /> });
  }
  failActions.push({
    label: "Try again",
    onPress: () => {
      ads.showInterstitial(); // natural break after the 3 s board review
      restart();
    },
    variant: failActions.length ? "light" : "primary",
  });

  // ---------------------------------------------------------------- tutorial coaching
  // Kept for the whole level so the board never jumps. On small phones the tutorial's step bubble carries the
  // instruction, so the long coach card gives its room to the board.
  const coach = tutorial && compact ? null : level?.hint ?? null;
  const tutorialCell = useMemo(() => {
    if (!tutorial || phase !== "play" || g.status !== "playing") return null;
    return findHint(g);
  }, [g, tutorial, phase]);
  // The next tutorial step is a safe tile → put the player back on Reveal so "tap" means reveal.
  useEffect(() => {
    if (tutorialCell && !tutorialCell.pod && tool === "flag") {
      setTool("reveal");
      feedback("tap", "select");
    }
  }, [tutorialCell, tool]);
  // One instruction at a time, always matching the controls on screen: switch to Flag, then tap.
  const needFlagTool = !!tutorialCell?.pod && tool === "reveal";
  const step = !tutorialCell ? null
    : tutorialCell.pod
      ? needFlagTool ? "The numbers say this hides a pod — switch to Flag up top" : "Tap to plant a flag on the pod"
      : g.flag.some(Boolean) ? "Its number already has its pods — this one's safe" : "Safe — tap to reveal";
  // The pointing hand only coaches until the first flag is planted; after that the glow + bubble guide.
  const [handDone, setHandDone] = useState(false);
  useEffect(() => {
    if (tutorial && !handDone && g.flag.some(Boolean)) setHandDone(true);
  }, [g, tutorial, handDone]);
  // Where the Flag half of the tool switch sits (for pointing at it), in this screen's coordinates.
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const flagRef = useRef<ComponentRef<typeof View>>(null);
  const [flagAt, setFlagAt] = useState<{ x: number; y: number } | null>(null);
  const measureFlag = useCallback(() => {
    if (!tutorial) return;
    setTimeout(() => {
      rootRef.current?.measureInWindow((rx, ry) => {
        flagRef.current?.measureInWindow((fx, fy, fw, fh) => {
          if (fw > 0) setFlagAt({ x: fx - rx + fw / 2, y: fy - ry + fh / 2 });
        });
      });
    }, 350);
  }, [tutorial]);
  // Coach card fades away 0.4 s after the field is cleared (layout is kept, so nothing jumps).
  const coachFade = useSharedValue(1);
  useEffect(() => {
    coachFade.value = withTiming(g.status === "won" ? 0 : 1, { duration: 400 });
  }, [g.status, coachFade]);
  const coachStyle = useAnimatedStyle(() => ({ opacity: coachFade.value }));
  const tile = tutorialCell ? { x: origin.x + (tutorialCell.cell % g.w) * cell + cell / 2, y: origin.y + Math.floor(tutorialCell.cell / g.w) * cell } : null;
  // The bubble hangs in the strip just above the tray (or below it when there's more room there), points at the
  // target column, and reflows onto two lines on narrow phones instead of truncating.
  const BUBBLE_W = Math.min(width - 24, 300);
  const [bubbleH, setBubbleH] = useState(36);
  const trayTop = origin.y - TRAY_PAD, trayBottom = origin.y - TRAY_PAD + boardH;
  const roomAbove = trayTop - area.y, roomBelow = area.y + area.h - trayBottom;
  const bubbleBelow = roomAbove < bubbleH + 10 && roomBelow > roomAbove;
  const bubbleLeft = tile ? Math.max(12, Math.min(width - BUBBLE_W - 12, tile.x - BUBBLE_W / 2)) : 0;
  const bubbleTop = bubbleBelow ? trayBottom + 8 : Math.max(area.y - 4, trayTop - bubbleH - 8);
  const pods = podsRemaining(g);
  const title = isLevel ? `Level ${session.level}` : session.daily !== undefined ? `Daily · ${session.mode.name}` : session.mode.name;
  const subtitle = isLevel ? `${CHAPTERS[level!.chapter - 1].name} · ${level!.title}` : session.cozy ? "No-Fail Cozy · unranked" : `${session.mode.w}×${session.mode.h} · ${session.mode.pods} pods`;
  const target = facts ? `3★ under ${fmtTime(facts.starTimes[0])}` : session.kind === "free" && prefs.modeStats?.[session.mode.id]?.best !== undefined ? `Best ${fmtTime(prefs.modeStats[session.mode.id].best!)}` : "First tap is always safe";
  const left = !!prefs.leftHanded;

  // QA replay: once the board is laid out (and after every accepted move) report the window-pixel centre of the
  // next tile the solver opens — measured fresh, after the entrance / cascade animations have settled.
  const boardRef = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!qaMode || area.h <= 0 || !isLevel) return;
    if (g.status === "won") {
      reportNext(session.level, null);
      return;
    }
    if (g.status !== "playing" || !g.board || phase !== "play") return;
    const id = setTimeout(() => {
      const s = gRef.current;
      if (s !== g || !s.board) return;
      const b = s.board;
      const ordered: number[] = [];
      for (const st of solve(b, s.open, 4).steps) for (const c of st.safe) if (!s.open[c]) ordered.push(c);
      b.pod.forEach((p, i) => { if (!p && !s.open[i] && !s.flag[i]) ordered.push(i); }); // safe either way
      boardRef.current?.measureInWindow((bx, by) => {
        const win = Dimensions.get("window");
        const pt = (i: number) => ({ x: bx + TRAY_PAD + (i % s.w) * cell + cell / 2, y: by + TRAY_PAD + Math.floor(i / s.w) * cell + cell / 2 });
        const next = ordered.find((i) => { const p = pt(i); return p.x > 0 && p.y > 0 && p.x < win.width && p.y < win.height; }) ?? ordered[0];
        if (next !== undefined) reportNext(session.level, pt(next));
      });
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, area.h, area.w, cell, round, phase, qaMode]);

  const hud = (
    <ArtPanel style={styles.hud} inset={[60, 60, 60, 60]} k={0.36}>
      <View style={[styles.hudRow, left && { flexDirection: "row-reverse" }]}>
        <View style={styles.podBox}>
          <Sprite id="tile_mine_seedpod" crop={POD_CROP} width={24} />
          <PodCount value={pods} />
          <Text style={styles.podLabel}>{"Pods\nleft"}</Text>
        </View>
        <ToolSwitch tool={tool} onChange={setTool} flagRef={flagRef} onLayout={measureFlag} />
      </View>
      <View style={styles.hudRule} />
      <View style={[styles.hudRow, styles.hudRow2, compact && styles.hudRow2Compact, left && { flexDirection: "row-reverse" }]}>
        <Clock get={elapsed} />
        {facts && !demo?.win ? (
          <StarMeter get={elapsed} times={facts.starTimes} capped={g.usedUndo || g.hintsUsed > 0} />
        ) : (
          <Text style={styles.target} numberOfLines={1}>{session.kind === "free" && session.cozy && g.mistakes ? `${g.mistakes} slip${g.mistakes > 1 ? "s" : ""}` : target}</Text>
        )}
      </View>
    </ArtPanel>
  );

  const board = (
    <View ref={boardRef} collapsable={false}>
    <BoardView g={g} cell={cell} delays={delays} wave={phase === "won"} hint={hintMark ?? (tutorialCell ? { cell: tutorialCell.cell, mark: tutorialCell.pod ? 2 : 1 } : null)} colorblind={!!prefs.colorblind} holdMs={prefs.holdMs ?? 400} onTap={onTap} onHold={onHold} />
    </View>
  );

  const hintsLeft = HINT_CAP - g.hintsUsed;
  const bottom = [
    <IconButton key="hint" icon="hint" label="Hint" badge={hintsLeft} onPress={askHint} disabled={phase !== "play" || !g.board || hintsLeft <= 0} />,
    <GameButton
      key="undo"
      style={{ flex: 1, maxWidth: 220 }}
      variant="light"
      label={g.undoLeft > 0 ? "Undo" : "Undo used"}
      icon={<Icon name="undo" size={22} />}
      onPress={doUndo}
      disabled={phase !== "play" || g.undoLeft <= 0 || !g.prev}
    />,
    <IconButton key="restart" icon="restart" label="Restart" onPress={() => restart()} disabled={phase === "won"} />,
  ];
  if (left) bottom.reverse();

  return (
    <View style={styles.root} ref={rootRef}>
      <Background theme={theme} leaves />
      <Animated.View style={[styles.stage, awaySt]}>
      <TopBar
        title={title}
        subtitle={subtitle}
        onBack={onExit}
        backIcon={isLevel ? "map" : "home"}
        right={<IconButton icon="pause" size={48} onPress={() => setPaused(true)} disabled={phase !== "play"} />}
      />
      <Animated.View entering={FadeInDown.duration(220)} style={styles.hudWrap}>{hud}</Animated.View>
      {coach ? (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.coachWrap, coachStyle]}>
          <Panel pad={7} style={styles.coach}>
            <View style={styles.coachRow}>
              <Leaf size={18} />
              <Text style={styles.coachText} numberOfLines={3}>{coach}</Text>
            </View>
          </Panel>
        </Animated.View>
      ) : null}
      <View
        style={styles.boardArea}
        onLayout={(e) => {
          const { x, y, width: w, height: h } = e.nativeEvent.layout;
          setArea({ x, y, w, h });
        }}
      >
        {area.h > 0 ? (
          <Animated.View style={[{ flex: 1 }, boardInSt]}>
          <Animated.View style={[{ flex: 1 }, shakeStyle]}>
            {scrolls ? (
              <ScrollView contentContainerStyle={{ padding: 8, alignItems: "center" }} showsVerticalScrollIndicator={false}>
                <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 8 }} showsHorizontalScrollIndicator={false}>
                  {board}
                </ScrollView>
              </ScrollView>
            ) : (
              <View style={styles.boardCenter}>
                <Animated.View pointerEvents="none" style={[styles.winGlow, { width: boardW + 24, height: boardH + 24 }, winGlowStyle]} />
                {board}
                <Animated.View pointerEvents="none" style={[styles.review_dim, { width: boardW, height: boardH }, dimStyle]} />
              </View>
            )}
          </Animated.View>
          </Animated.View>
        ) : null}
        {phase === "review" ? (
          <Animated.View entering={FadeIn.duration(200)} pointerEvents="none" style={styles.reviewWrap}>
            <Text style={styles.review}>A seed pod — take a look at the field</Text>
          </Animated.View>
        ) : null}
      </View>
      {tutorial && area.h > 0 && !scrolls ? (
        <CoachBubble
          text={tutorialCell && tile ? step : null}
          width={BUBBLE_W}
          left={bubbleLeft}
          top={bubbleTop}
          tailX={tile ? Math.max(14, Math.min(BUBBLE_W - 26, tile.x - bubbleLeft - 6)) : BUBBLE_W / 2 - 6}
          below={bubbleBelow}
          onHeight={setBubbleH}
        />
      ) : null}
      {tutorialCell && tile && area.h > 0 && !scrolls && (needFlagTool ? !!flagAt : !handDone) ? (
        <TutorialHand
          key={needFlagTool ? "flag-tool" : tutorialCell.cell}
          from={needFlagTool && flagAt ? flagAt : { x: tile.x, y: tile.y + cell / 2 }}
          cell={needFlagTool ? 30 : cell}
        />
      ) : null}
      {sparkle ? (
        <Animated.View key={sparkle.key} pointerEvents="none" style={[styles.sparkle, { left: sparkle.x - 40, top: sparkle.y - 40 }]}>
          <SparkleBurst />
        </Animated.View>
      ) : null}
      {ripple ? <Shockwave key={ripple.key} x={ripple.x} y={ripple.y} size={cell * 5} /> : null}
      {floater ? <FloatingText key={floater.key} text={floater.text} color={floater.color ?? palette.sageDark} x={floater.x ?? width / 2} y={floater.y ?? area.y + 30} duration={1400} /> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vignette, vignetteStyle]} />
      <Confetti trigger={confetti} count={90} origin={{ x: width / 2, y: area.y + area.h * 0.45 }} />
      <LeafConfetti trigger={Math.ceil(confetti / 2)} count={22} />
      {cheer && !win && area.h > 0 ? <WinCheer stars={cheer.stars} leaves={cheer.leaves} top={area.y + area.h / 2} /> : null}
      <View style={[styles.actions, compact && { paddingTop: 4 }, { paddingBottom: insets.bottom + bannerH + (compact ? 6 : 12) }]}>{bottom}</View>
      </Animated.View>

      <WinPopup
        visible={phase === "won" && !!win && (demo ? !!demo.win : true)}
        stars={win?.stars}
        coins={win?.leaves ?? 0}
        time={fmtTime(elapsed())}
        best={win?.best !== undefined ? fmtTime(win.best) : undefined}
        note={win?.note}
        title={isLevel ? "Field Cleared!" : "Board Cleared!"}
        nextLabel={isLevel ? (session.level < LEVELS.length ? "Next Level" : "Free Play") : "New Board"}
        onNext={() => {
          ads.showInterstitial();
          if (isLevel) {
            if (session.level < LEVELS.length) onNextLevel(session.level + 1);
            else onFreePlay?.();
          } else restart();
        }}
        onReplay={isLevel ? () => { ads.showInterstitial(); restart(); } : undefined}
        onMap={() => { ads.showInterstitial(); onExit(); }}
      />
      <FailPopup
        visible={phase === "lost"}
        message={g.undoLeft > 0 ? "Every field can be cleared without guessing. Your free Undo takes that tap back." : "Every field can be cleared without guessing — look at the numbers again."}
        actions={failActions}
        onMap={() => { ads.showInterstitial(); onExit(); }}
      />
      <Popup visible={paused} title="Paused" onClose={() => setPaused(false)}>
        <View style={{ gap: 10 }}>
          <GameButton label="Resume" size="lg" variant="primary" icon={<Icon name="play" size={20} color="#FFFBF0" engraved={false} />} onPress={() => setPaused(false)} />
          <GameButton label="Restart" variant="light" icon={<Icon name="restart" size={20} />} onPress={() => restart()} />
          <GameButton label="Settings" variant="light" icon={<Icon name="settings" size={20} />} onPress={() => { setPaused(false); onSettings(); }} />
          <GameButton label={isLevel ? "Map" : "Home"} variant="light" icon={<Icon name={isLevel ? "map" : "home"} size={20} />} onPress={() => { setPaused(false); onExit(); }} />
        </View>
      </Popup>
      <Popup visible={hintAsk} title="Hint" onClose={() => setHintAsk(false)}>
        <Text style={styles.hintMsg}>Confirms one tile: a safe tile to open, or a pod to flag. {hintsLeft} left this board.</Text>
        <View style={{ gap: 10 }}>
          {ads.rewardedAvailable() ? (
            <GameButton label="Watch a short ad" variant="primary" icon={<Icon name="ad" size={22} color="#FFFBF0" engraved={false} />} onPress={() => { setHintAsk(false); ads.showRewarded(() => giveHint("ad")); }} />
          ) : null}
          <GameButton
            label={`Use ${HINT_LEAVES} leaves`}
            variant="light"
            icon={<Leaf size={22} />}
            disabled={prefs.coins < HINT_LEAVES}
            onPress={() => giveHint("leaves")}
          />
          <Text style={styles.hintNote}>You have {prefs.coins} leaves</Text>
          <GameButton label="Not now" size="sm" variant="light" onPress={() => setHintAsk(false)} />
        </View>
      </Popup>
    </View>
  );
}

/**
 * The tutorial's single coaching bubble. It is never re-mounted per step (two keyed bubbles cross-fading drew a
 * doubled, half-transparent bubble): it glides to the next tile's anchor with its tail, and the line inside
 * dips out, swaps and comes back while the bubble itself stays solid. No elevation — on Android an elevated
 * view under a fading opacity paints its shadow as a grey band over the text.
 */
function CoachBubble({ text, width, left, top, tailX, below, onHeight }: {
  text: string | null; width: number; left: number; top: number; tailX: number; below: boolean; onHeight: (h: number) => void;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const op = useSharedValue(0); // whole bubble
  const txt = useSharedValue(1); // the line inside
  const x = useSharedValue(left), y = useSharedValue(top), tail = useSharedValue(tailX);
  const placed = useRef(false);
  useEffect(() => {
    const ease = { duration: 240, easing: Easing.out(Easing.cubic) };
    if (!placed.current) {
      x.value = left; y.value = top; tail.value = tailX;
    } else {
      x.value = withTiming(left, ease); y.value = withTiming(top, ease); tail.value = withTiming(tailX, ease);
    }
  }, [left, top, tailX, x, y, tail]);
  useEffect(() => {
    if (text === shown) return;
    if (text === null) {
      // Step done (field cleared / review): the one bubble fades out where it is.
      op.value = withTiming(0, { duration: 180 });
      const id = setTimeout(() => { setShown(null); placed.current = false; }, 190);
      return () => clearTimeout(id);
    }
    if (shown === null) {
      setShown(text);
      placed.current = true;
      txt.value = 1;
      op.value = withTiming(1, { duration: 200 });
      return;
    }
    // Next step: same bubble, the old line dips out before the new one comes in — one line on screen at a time.
    txt.value = withTiming(0, { duration: 110 });
    const id = setTimeout(() => {
      setShown(text);
      txt.value = withTiming(1, { duration: 160 });
    }, 120);
    return () => clearTimeout(id);
  }, [text, shown, op, txt]);
  const box = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const line = useAnimatedStyle(() => ({ opacity: txt.value }));
  const tailSt = useAnimatedStyle(() => ({ transform: [{ translateX: tail.value }, { rotate: "45deg" }] }));
  if (shown === null && text === null) return null;
  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e) => onHeight(Math.round(e.nativeEvent.layout.height))}
      style={[styles.bubble, { width }, box]}
    >
      <Animated.View style={[styles.bubbleTail, below ? styles.bubbleTailUp : styles.bubbleTailDown, tailSt]} />
      <Animated.Text style={[styles.bubbleText, line]} numberOfLines={2}>{shown ?? text}</Animated.Text>
    </Animated.View>
  );
}

/**
 * The win moment on the board itself (before the result card): a paper ribbon springs in, the stars fill
 * one by one with chimes, and the leaf reward pops and counts up.
 */
function WinCheer({ stars, leaves, top }: { stars: number; leaves: number; top: number }) {
  const s = useSharedValue(0);
  const coin = useSharedValue(0);
  const [counting, setCounting] = useState(false);
  useEffect(() => {
    s.value = withSpring(1, springs.pop);
    coin.value = withDelay(stars ? 1150 : 350, withSequence(withTiming(1.25, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(1, springs.pop)));
    const id = setTimeout(() => { setCounting(true); play("coin"); }, stars ? 1150 : 350);
    return () => clearTimeout(id);
  }, [s, coin, leaves, stars]);
  const card = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value * 2), transform: [{ scale: 0.6 + 0.4 * s.value }, { translateY: (1 - s.value) * 24 }] }));
  const coinSt = useAnimatedStyle(() => ({ opacity: Math.min(1, coin.value * 2), transform: [{ scale: coin.value }] }));
  return (
    <View pointerEvents="none" style={[styles.cheerWrap, { top: top - 92 }]}>
      <Animated.View style={card}>
        <Panel pad={12} style={styles.cheerCard}>
          <Text style={styles.cheerTitle}>Field Cleared!</Text>
          {stars ? <Stars count={stars} animate size={34} /> : null}
          <Animated.View style={[styles.cheerCoin, coinSt]}>
            <Leaf size={26} />
            <Text style={styles.cheerPlus}>+</Text>
            {counting ? <AnimatedNumber from={0} value={leaves} style={styles.cheerNum} duration={500} /> : <Text style={[styles.cheerNum, { opacity: 0 }]}>{leaves}</Text>}
          </Animated.View>
        </Panel>
      </Animated.View>
    </View>
  );
}

/** Soft muted ring rolling out from the uncovered pod (no explosion — a dull "thump" made visible). */
function Shockwave({ x, y, size }: { x: number; y: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const st = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - t.value), transform: [{ scale: 0.15 + t.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.shock, { left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2 }, st]} />;
}

/** Soft sparkle (fx_sparkle_soft) that blooms and fades over a big cascade. */
function SparkleBurst() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const st = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ scale: 0.5 + t.value * 0.9 }, { rotate: `${t.value * 25}deg` }] }));
  return (
    <Animated.View style={st}>
      <Sprite id="fx_sparkle_soft" width={80} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1 },
  hudWrap: { paddingHorizontal: 14, marginTop: 4 },
  hud: { borderRadius: 20 },
  hudRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  hudRow2: { paddingTop: 2, paddingBottom: 8 },
  hudRow2Compact: { paddingTop: 0, paddingBottom: 4 },
  hudRule: { height: 1.5, marginHorizontal: 16, marginTop: 6, backgroundColor: "rgba(160,120,70,0.2)" },
  podBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  podCountBox: { alignItems: "center", justifyContent: "center", minWidth: 30 },
  podHalo: { position: "absolute", width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(140,164,113,0.45)", shadowColor: "#B9E08A", shadowOpacity: 1, shadowRadius: 10 },
  podCount: { fontFamily: fonts.display, fontSize: 32, color: palette.brown, minWidth: 26, textAlign: "center", textShadowColor: "rgba(255,255,255,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  podLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 14, color: palette.inkSoft },
  clock: { fontFamily: fonts.display, fontSize: 26, color: palette.brown, fontVariant: ["tabular-nums"] },
  target: { fontFamily: fonts.body, fontSize: 13.5, color: palette.inkSoft, flexShrink: 1 },
  meter: { flex: 1, maxWidth: 210, flexDirection: "row", alignItems: "center", gap: 6 },
  meterStars: { flexDirection: "row", gap: 1 },
  meterTrack: { flex: 1, height: 22, borderRadius: 11, backgroundColor: "rgba(160,120,70,0.18)", borderWidth: 1.5, borderColor: "rgba(160,120,70,0.28)", overflow: "hidden", justifyContent: "center" },
  meterFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10, backgroundColor: "#F2C14E" },
  meterFill2: { backgroundColor: "#D9B98A" },
  meterText: { fontFamily: fonts.display, fontSize: 12.5, color: palette.brown, textAlign: "center", paddingHorizontal: 6 },
  tool: { width: 128, height: 46, borderRadius: 22, backgroundColor: "rgba(205,174,128,0.45)", flexDirection: "row", padding: 2 },
  toolPill: {
    position: "absolute", left: 2, top: 2, width: 62, height: 42, borderRadius: 20, borderWidth: 2,
    shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 5,
  },
  toolBreath: { position: "absolute", left: -4, top: -4, right: -4, bottom: -4, borderRadius: 27, borderWidth: 3, borderColor: "rgba(255,107,107,0.55)", shadowColor: "#FF6B6B", shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  toolItem: { flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3 },
  toolText: { fontFamily: fonts.display, fontSize: 14 },
  toolTextOn: { color: "#FFFBF0", textShadowColor: "rgba(255,255,210,0.8)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  toolTextOff: { color: "#8F857A", opacity: 0.6 },
  toolGlow: { shadowColor: "#FFF6C8", shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  toolIdle: { opacity: 0.4 },
  bubble: {
    position: "absolute", left: 0, top: 0, minHeight: 34, zIndex: 25, paddingVertical: 7, borderRadius: 17, backgroundColor: "#4E3B26", alignItems: "center", justifyContent: "center", paddingHorizontal: 12,
    borderBottomWidth: 3, borderColor: "#33251A",
  },
  bubbleText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 19, color: "#FFF6E4", textAlign: "center" },
  bubbleTail: { position: "absolute", left: 0, width: 12, height: 12, backgroundColor: "#4E3B26" },
  bubbleTailDown: { bottom: -7, backgroundColor: "#33251A" },
  bubbleTailUp: { top: -5 },
  vignette: { borderWidth: 34, borderColor: "rgba(214,72,52,0.42)", backgroundColor: "rgba(228,102,79,0.14)" },
  coachWrap: { paddingHorizontal: 22, marginTop: 6 },
  coach: {},
  coachRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 },
  coachText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: palette.ink },
  reviewWrap: { position: "absolute", top: 0, alignSelf: "center", backgroundColor: "rgba(91,70,50,0.88)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 7 },
  review: { fontFamily: fonts.display, fontSize: 15, color: "#FFF6E4" },
  boardArea: { flex: 1, marginTop: 6 },
  boardCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  review_dim: { position: "absolute", borderRadius: 18, backgroundColor: "rgba(110,100,90,0.22)" },
  sparkle: { position: "absolute", width: 80, height: 80 },
  cheerWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 40, elevation: 40 },
  winGlow: { position: "absolute", borderRadius: 30, backgroundColor: "rgba(255,226,140,0.35)", borderWidth: 4, borderColor: "rgba(255,236,170,0.9)", shadowColor: "#FFD45E", shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  cheerCard: { minWidth: 230 },
  cheerTitle: { fontFamily: fonts.display, fontSize: 26, color: palette.brown, textAlign: "center", textShadowColor: "rgba(255,255,255,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  cheerCoin: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, alignSelf: "center", backgroundColor: "rgba(140,164,113,0.2)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  cheerPlus: { fontFamily: fonts.display, fontSize: 22, color: palette.sageDark },
  cheerNum: { fontFamily: fonts.display, fontSize: 26, color: palette.sageDark, minWidth: 28 },
  shock: { position: "absolute", borderWidth: 6, borderColor: "rgba(120,96,70,0.55)", backgroundColor: "rgba(255,180,158,0.12)" },
  // Bottom controls always draw above every board overlay (bubbles, hand, floaters, fx).
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 20, paddingTop: 8, zIndex: 30, elevation: 30 },
  freeTag: { fontFamily: fonts.display, fontSize: 12, color: palette.sageDark, backgroundColor: "#FFF8EA", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" },
  hintMsg: { fontFamily: fonts.body, fontSize: 15, color: palette.inkSoft, textAlign: "center", marginBottom: 14, lineHeight: 21 },
  hintNote: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft, textAlign: "center" },
});
