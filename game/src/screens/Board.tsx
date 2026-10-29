import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { cancelAnimation,
  Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { art } from "../art";
import { BURST_CROP, NineSliceArt, POD_CROP, Sprite, fonts, numberInk, springs } from "../ui";
import type { GameState } from "../game/engine";
import { DustPuff, FlagSpecks, HoldRing, TouchRipple, runHold, stopHold } from "../fx/BoardFx";

/** What one cell shows. "pod" / "burst" / "wrong" only appear in the post-game review. */
export type CellKind = "hidden" | "flag" | "num" | "pod" | "burst" | "wrong";
export type HintMark = 0 | 1 | 2; // 1 = confirmed safe, 2 = confirmed pod

export function cellKind(g: GameState, i: number): { kind: CellKind; n: number } {
  const b = g.board;
  const over = g.status === "lost";
  if (g.open[i]) {
    if (b?.pod[i]) return { kind: "burst", n: 0 };
    return { kind: "num", n: b?.num[i] ?? 0 };
  }
  if (g.flag[i]) return { kind: over && b && !b.pod[i] ? "wrong" : "flag", n: 0 };
  if (over && b?.pod[i]) return { kind: "pod", n: 0 };
  return { kind: "hidden", n: 0 };
}

/** Frame of the wooden tray (source px of the art and its on-screen thickness). */
export const TRAY_INSET = 48;
export const TRAY_K = 0.36;
const TRAY_RIM = 36; // source px of the wooden rim itself
export const TRAY_PAD = Math.round(TRAY_INSET * TRAY_K) + 4;

// Dice-pip layouts (3×3 positions) for the colour-blind shape marks.
const PIPS: number[][] = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8]];

function Pips({ n, size }: { n: number; size: number }) {
  const d = Math.max(2, Math.round(size * 0.055));
  const box = d * 3 + 4;
  return (
    <View style={{ position: "absolute", right: size * 0.1, bottom: size * 0.1, width: box, height: box }}>
      {PIPS[n].map((p) => (
        <View key={p} style={{ position: "absolute", left: (p % 3) * (d + 2), top: Math.floor(p / 3) * (d + 2), width: d, height: d, borderRadius: d / 2, backgroundColor: numberInk[n], opacity: 0.85 }} />
      ))}
    </View>
  );
}

interface TileProps {
  i: number;
  kind: CellKind;
  n: number;
  size: number;
  delay: number; // reveal ripple delay (ms) for cells opened by the latest action
  wave: number; // win wave delay (ms), 0 = none
  hint: HintMark;
  last: boolean; // highlighted last action in the review
  colorblind: boolean;
  holdMs: number;
  onTap: (i: number) => void;
  onHold: (i: number) => void;
  onTouch: (i: number, down: boolean, x?: number, y?: number) => void;
}

/**
 * One tile. Hidden = raised bright card with a dark lip (reads "press me"); revealed = sunken, darker
 * paper with embossed ink — the two states differ in value AND depth at a glance.
 */
const Tile = memo(function Tile({ i, kind, n, size, delay, wave, hint, last, colorblind, holdMs, onTap, onHold, onTouch }: TileProps) {
  const s = useSharedValue(1);
  const dy = useSharedValue(0);
  const press = useSharedValue(0);
  const ring = useSharedValue(0);
  const flash = useSharedValue(0);
  const glow = useSharedValue(0); // warm touch highlight (every touch, even ones that change nothing)
  const downAt = useRef(0);
  const ink = useSharedValue(1); // number fade-in
  const pulse = useSharedValue(0); // bright bloom when the tile becomes the guided target
  const was = useRef(kind);
  const raised = kind === "hidden" || kind === "flag" || kind === "wrong";
  useEffect(() => {
    const before = was.current;
    was.current = kind;
    if (before === kind) return; // first mount: no entrance (screen transitions own that)
    if (kind === "num" || kind === "burst") {
      // Gentle pop + a soft paper flash as the card turns over.
      s.value = 0.86;
      s.value = withDelay(delay, withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2.2)) }));
      flash.value = 0;
      flash.value = withDelay(delay, withSequence(withTiming(kind === "burst" ? 0.9 : 0.55, { duration: 70 }), withTiming(0, { duration: 260 })));
      ink.value = 0;
      ink.value = withDelay(delay + 40, withTiming(1, { duration: 120 }));
      if (kind === "burst") s.value = withDelay(delay, withSequence(withTiming(1.22, { duration: 110 }), withSpring(1, springs.pop)));
    } else if (kind === "flag") {
      // Planted: 150 ms pop — squash, overshoot to 1.16, settle — with a little hop.
      dy.value = withSequence(withTiming(-5, { duration: 70 }), withSpring(0, springs.pop));
      s.value = 0.82;
      s.value = withSequence(withTiming(1.16, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 60, easing: Easing.in(Easing.quad) }));
    } else if (kind === "hidden" && before === "flag") {
      // Pin pulled out: a little squash and settle.
      s.value = withSequence(withTiming(0.9, { duration: 80 }), withSpring(1, springs.pop));
    } else if (kind === "pod" || kind === "wrong") {
      s.value = 0.5;
      s.value = withDelay(delay, withSpring(1, springs.pop));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  const shine = useSharedValue(0); // golden sweep of the win wave
  useEffect(() => {
    if (wave <= 0) return;
    s.value = withDelay(wave, withSequence(withTiming(1.12, { duration: 120, easing: Easing.out(Easing.quad) }), withSpring(1, springs.pop)));
    dy.value = withDelay(wave, withSequence(withTiming(-4, { duration: 120 }), withSpring(0, springs.pop)));
    shine.value = withDelay(wave, withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 520, easing: Easing.out(Easing.quad) })));
  }, [wave, s, dy, shine]);
  useEffect(() => {
    if (!hint) return;
    // A new guided target: 120 ms glow bloom + a small lift so the eye lands on it.
    pulse.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 420 }));
    s.value = withSequence(withTiming(1.07, { duration: 120 }), withSpring(1, springs.pop));
  }, [hint, pulse, s]);
  useEffect(() => {
    ring.value = hint || last ? withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.6, { duration: 600 })), -1) : withTiming(0, { duration: 150 });
  }, [hint, last, ring]);
  // Unmounted tiles (new level, restart) must not leave their loops running on the UI thread.
  useEffect(() => () => [s, dy, press, ring, flash, glow, ink, pulse, shine].forEach((v) => cancelAnimation(v)), [s, dy, press, ring, flash, glow, ink, pulse, shine]);
  // Touch-down: 80 ms press to 0.92 and 1.5 px down, the lip shadow darkens (the card is pushed into the tray).
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: dy.value + press.value * 1.5 }, { scale: s.value * (1 - press.value * 0.08) }] }));
  const glowSt = useAnimatedStyle(() => ({ opacity: glow.value * 0.5 }));
  const shadeSt = useAnimatedStyle(() => ({ opacity: press.value * 0.22 }));
  const lipSt = useAnimatedStyle(() => ({ backgroundColor: press.value > 0.5 ? "#7E5F38" : "#A88559" }));
  const pulseSt = useAnimatedStyle(() => ({ opacity: pulse.value * 0.75 }));
  const inkSt = useAnimatedStyle(() => ({ opacity: ink.value, transform: [{ scale: 0.8 + ink.value * 0.2 }] }));
  const ringSt = useAnimatedStyle(() => ({ opacity: ring.value }));
  const flashSt = useAnimatedStyle(() => ({ opacity: flash.value }));
  const shineSt = useAnimatedStyle(() => ({ opacity: shine.value * 0.8 }));
  const inner = size - 3;
  const r = Math.max(6, Math.round(size * 0.22));
  const glyph = Math.round(size * 0.58);
  return (
    <Pressable
      onPress={() => onTap(i)}
      onLongPress={() => onHold(i)}
      delayLongPress={holdMs}
      onPressIn={(e) => {
        // Every touch answers at once: squash to 0.92 + warm highlight (open tiles too, even if nothing happens).
        downAt.current = Date.now();
        press.value = withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) });
        glow.value = withTiming(1, { duration: 60 });
        onTouch(i, true, e.nativeEvent.locationX, e.nativeEvent.locationY);
      }}
      onPressOut={() => {
        // Release: the full dip always plays (even for an instant tap) — 0.92 by +80 ms, pop to 1.03 at
        // +180 ms, settle at 1.00 by +280 ms — and the highlight fades with it.
        const left = Math.max(0, 80 - (Date.now() - downAt.current));
        press.value = withSequence(withTiming(1, { duration: left }), withTiming(0, { duration: 100, easing: Easing.out(Easing.quad) }));
        s.value = withDelay(left, withSequence(withTiming(1.03, { duration: 100, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 100, easing: Easing.inOut(Easing.quad) })));
        glow.value = withDelay(left + 60, withTiming(0, { duration: 200 }));
        onTouch(i, false);
      }}
      style={{ width: size, height: size, padding: 1.5, overflow: "visible" }}
      accessibilityLabel={kind === "num" ? (n ? `${n}` : "empty") : kind}
    >
      <Animated.View style={[{ width: inner, height: inner }, st]}>
        {raised ? (
          <>
            <Animated.View style={[styles.lip, { borderRadius: r, top: 3, left: Math.round(inner * 0.03), width: inner - 2 * Math.round(inner * 0.03), height: inner - 1 }, lipSt]} />
            {/* Every tile image is pinned to exactly the cell (explicit px size + clip): Android draws an Image
                with only absolute insets at its intrinsic 512 px size, which overflowed the board. */}
            <View style={[styles.clip, { width: inner, height: inner, borderRadius: r }]}>
              <Image source={art.tile_hidden_card} resizeMode="stretch" style={{ width: inner, height: inner }} />
              <LinearGradient colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0)"]} style={{ position: "absolute", left: Math.round(inner * 0.04), top: Math.round(inner * 0.04), width: inner - 2 * Math.round(inner * 0.04), height: Math.round(inner * 0.5), borderRadius: r }} />
            </View>
          </>
        ) : (
          <View style={[styles.clip, { top: 1.5, width: inner, height: inner - 1.5, borderRadius: r }]}>
            <Image source={art.tile_revealed_empty} resizeMode="stretch" style={{ width: inner, height: inner - 1.5 }} />
            <View style={[styles.fill, { backgroundColor: kind === "burst" ? "rgba(255,107,107,0.35)" : "rgba(150,108,58,0.14)" }]} />
            <LinearGradient colors={["rgba(110,74,34,0.22)", "rgba(110,74,34,0)"]} style={{ position: "absolute", left: 0, top: 0, width: inner, height: Math.round(inner * 0.3) }} />
          </View>
        )}
        <View style={[styles.fill, styles.center]}>
          {kind === "num" && n > 0 ? (
            <Animated.Text allowFontScaling={false} style={[styles.num, { fontSize: glyph, lineHeight: glyph * 1.2, color: numberInk[n] }, inkSt]}>{n}</Animated.Text>
          ) : null}
          {kind === "flag" || kind === "wrong" ? <FlutterFlag size={size} seed={i} /> : null}
          {kind === "pod" ? <Sprite id="tile_mine_seedpod" crop={POD_CROP} width={Math.round(size * 0.5)} /> : null}
          {kind === "burst" ? <Sprite id="tile_mine_seedpod" crop={BURST_CROP} width={Math.round(size * 0.74)} /> : null}
          {kind === "wrong" ? (
            <View style={[styles.fill, styles.center]}>
              <Text allowFontScaling={false} style={[styles.cross, { fontSize: size * 0.62 }]}>×</Text>
            </View>
          ) : null}
        </View>
        {kind === "num" && n > 0 && colorblind ? <Pips n={n} size={inner} /> : null}
        {!raised ? <Animated.View pointerEvents="none" style={[styles.fill, { top: 1.5, borderRadius: r, backgroundColor: kind === "burst" ? "#FFB49E" : "#FFFDF6" }, flashSt]} /> : null}
        <Animated.View pointerEvents="none" style={[styles.fill, styles.shade, { borderRadius: r }, shadeSt]} />
        <Animated.View pointerEvents="none" style={[styles.fill, styles.touchGlow, { borderRadius: r }, glowSt]} />
        {hint || last ? (
          <Animated.View pointerEvents="none" style={[styles.fill, { margin: -3, borderRadius: r + 3 }, ringSt]}>
            <View
              style={[
                styles.fill,
                styles.ring,
                { borderRadius: r + 3, borderColor: last ? "#C8432C" : hint === 1 ? "#2E7D32" : "#D07A12", shadowColor: last ? "#FF6B6B" : hint === 1 ? "#7CD35F" : "#FFB43A" },
              ]}
            />
            <View style={[styles.fill, styles.ringInner, { margin: 4, borderRadius: r - 1 }]} />
          </Animated.View>
        ) : null}
        {hint ? <Animated.View pointerEvents="none" style={[styles.fill, styles.bloom, { borderRadius: r }, pulseSt]} /> : null}
        {wave > 0 ? <Animated.View pointerEvents="none" style={[styles.fill, styles.shine, { borderRadius: r }, shineSt]} /> : null}
      </Animated.View>
    </Pressable>
  );
});

/** Fabric flag that flutters softly on its pin — the board is never fully still. */
function FlutterFlag({ size, seed }: { size: number; seed: number }) {
  const t = useSharedValue(0);
  const pop = useSharedValue(0);
  useEffect(() => {
    // The flag sprouts out of the card like a seedling: grows up from its base to 1.18, settles at 1 by 200 ms.
    pop.value = withSequence(withTiming(1.18, { duration: 130, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 70 }));
    t.value = withDelay((seed * 137) % 900, withRepeat(withTiming(1, { duration: 1100 + (seed % 5) * 90, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => { cancelAnimation(t); cancelAnimation(pop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, seed]);
  const h = Math.round(size * 0.5 * (512 / 414));
  const st = useAnimatedStyle(() => ({
    transform: [
      // scaleY grows from the base of the pin (shift by half the lost height so the foot stays planted)
      { translateY: (h / 2) * (1 - pop.value) },
      { scaleY: pop.value },
      { scaleX: Math.min(1, 0.55 + pop.value * 0.45) * (0.96 + t.value * 0.04) },
      { skewY: `${-3 + t.value * 6}deg` },
    ],
  }));
  return (
    <Animated.View style={[{ marginLeft: size * 0.06 }, st]}>
      <Sprite id="tile_flag_fabric" width={Math.round(size * 0.5)} />
    </Animated.View>
  );
}

/** The wooden tray with its grooved floor and an explicit row-by-row grid of whole-pixel tiles. */
type Fx = { key: string; kind: "ripple" | "specks" | "puff" | "burst"; i: number; delay: number; dx?: number; dy?: number; done: number };
const FX_LIFE = 700; // longest one-shot effect (burst puff 520 ms) + margin
let fxSeq = 0;

export function BoardView({ g, cell, delays, wave, hint, colorblind, holdMs, onTap, onHold }: {
  g: GameState; cell: number; delays: Map<number, number>; wave: boolean; hint: { cell: number; mark: HintMark } | null;
  colorblind: boolean; holdMs: number; onTap: (i: number) => void; onHold: (i: number) => void;
}) {
  const W = g.w * cell + TRAY_PAD * 2;
  const H = g.h * cell + TRAY_PAD * 2;
  const rim = Math.round(TRAY_RIM * TRAY_K) - 4;
  const last = g.status === "lost" && g.burst !== null ? g.burst : -1;

  // ---- touch + change effects (board coordinates)
  const [fx, setFx] = useState<Fx[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const holdP = useSharedValue(0);
  const gRef = useRef(g);
  gRef.current = g;
  const push = useCallback((items: Omit<Fx, "key" | "done">[]) => {
    if (!items.length) return;
    const now = Date.now();
    const stamped = items.map((f) => ({ ...f, key: `${fxSeq++}`, done: now + f.delay + FX_LIFE }));
    setFx((cur) => [...cur.slice(-40), ...stamped]);
  }, []);
  // Finished effects are unmounted (not kept around), so a long session never accumulates views.
  useEffect(() => {
    if (!fx.length) return;
    const next = Math.min(...fx.map((f) => f.done));
    const id = setTimeout(() => {
      const now = Date.now();
      setFx((cur) => cur.filter((f) => f.done > now));
    }, Math.max(16, next - Date.now()));
    return () => clearTimeout(id);
  }, [fx]);
  const onTouch = useCallback((i: number, down: boolean, x?: number, y?: number) => {
    const s = gRef.current;
    if (down) {
      // The ripple spreads from the fingertip itself, not the tile centre.
      push([{ kind: "ripple", i, delay: 0, dx: x !== undefined ? x - cell / 2 : 0, dy: y !== undefined ? y - cell / 2 : 0 }]);
      if (s.status === "playing" && !s.open[i]) {
        setHeld(i);
        runHold(holdP, holdMs);
      }
    } else {
      stopHold(holdP);
      setHeld(null);
    }
  }, [push, holdP, holdMs, cell]);
  const prev = useRef(g);
  useEffect(() => {
    const p = prev.current;
    prev.current = g;
    if (p === g || p.w !== g.w || p.h !== g.h) return;
    const items: Omit<Fx, "key" | "done">[] = [];
    let puffs = 0;
    const won = g.status === "won" && p.status !== "won";
    for (let i = 0; i < g.open.length; i++) {
      if (g.flag[i] && !p.flag[i]) {
        // A planted flag sprouts at once; on a win every remaining pod sprouts in the clearing wave.
        if (g.status === "playing") items.push({ kind: "specks", i, delay: 0 });
        else if (won) items.push({ kind: "specks", i, delay: (Math.floor(i / g.w) + (i % g.w)) * 40 });
      }
      if (g.open[i] && !p.open[i]) {
        if (g.burst === i) items.push({ kind: "burst", i, delay: delays.get(i) ?? 0 });
        else if (puffs++ < 30) items.push({ kind: "puff", i, delay: delays.get(i) ?? 0 });
      }
    }
    push(items);
  }, [g, delays, push]);
  const at = (i: number) => ({ x: TRAY_PAD + (i % g.w) * cell + cell / 2, y: TRAY_PAD + Math.floor(i / g.w) * cell + cell / 2 });
  return (
    <View style={[styles.tray, { width: W, height: H }]}>
      <NineSliceArt id="board_tray_paperwood" inset={[TRAY_INSET, TRAY_INSET, TRAY_INSET, TRAY_INSET]} k={TRAY_K} w={W} h={H} />
      {/* The floor starts at the wood rim: the tray art's edge slices carry the tops of its baked-in tiles. */}
      <View style={[styles.floor, { left: rim, top: rim, right: rim, bottom: rim }]} />
      <View style={{ position: "absolute", left: TRAY_PAD, top: TRAY_PAD }}>
        {Array.from({ length: g.h }, (_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: g.w }, (_, c) => {
              const i = r * g.w + c;
              const { kind, n } = cellKind(g, i);
              return (
                <Tile
                  key={i}
                  i={i}
                  kind={kind}
                  n={n}
                  size={cell}
                  delay={delays.get(i) ?? 0}
                  wave={wave ? 1 + (r + c) * 40 : 0}
                  hint={hint && hint.cell === i ? hint.mark : 0}
                  last={i === last}
                  colorblind={colorblind}
                  holdMs={holdMs}
                  onTap={onTap}
                  onHold={onHold}
                  onTouch={onTouch}
                />
              );
            })}
          </View>
        ))}
      </View>
      {fx.map((f) => {
        const p = at(f.i);
        if (f.kind === "ripple") return <TouchRipple key={f.key} x={p.x + (f.dx ?? 0)} y={p.y + (f.dy ?? 0)} size={cell} />;
        if (f.kind === "specks") return <FlagSpecks key={f.key} x={p.x} y={p.y} size={cell} delay={f.delay} />;
        return <DustPuff key={f.key} x={p.x} y={p.y} size={cell} delay={f.delay} burst={f.kind === "burst"} />;
      })}
      {held !== null ? <HoldRing x={at(held).x} y={at(held).y} size={cell} progress={holdP} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { shadowColor: "#4A2E12", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 12, borderRadius: 18 },
  floor: { position: "absolute", backgroundColor: "#CDAE80", borderRadius: 8 },
  row: { flexDirection: "row" },
  fill: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  clip: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  lip: { position: "absolute", backgroundColor: "#A88559" },
  center: { alignItems: "center", justifyContent: "center" },
  shade: { backgroundColor: "#3B2712" },
  touchGlow: { borderWidth: 3, borderColor: "#FFF7D6", backgroundColor: "rgba(255,236,170,0.55)" },
  ring: { borderWidth: 4, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  ringInner: { borderWidth: 1.5, borderColor: "rgba(255,252,240,0.95)" },
  shine: { backgroundColor: "#FFE38A", borderWidth: 2, borderColor: "#FFF8DC" },
  bloom: { backgroundColor: "#FFF6CC", shadowColor: "#FFE58A", shadowOpacity: 1, shadowRadius: 12 },
  num: { fontFamily: fonts.display, textAlign: "center", textShadowColor: "rgba(255,248,230,0.95)", textShadowOffset: { width: 0, height: 1.2 }, textShadowRadius: 0.5 },
  cross: { fontFamily: fonts.display, color: "#C0392B", marginTop: -4, textShadowColor: "rgba(255,255,255,0.8)", textShadowRadius: 2 },
});
