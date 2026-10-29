import { useEffect, useMemo, memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, cancelAnimation, type SharedValue } from "react-native-reanimated";
import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { art } from "../art";

/**
 * Board-level touch effects, drawn in board coordinates over the tiles (never intercepting touches):
 * a finger ripple on every touch, the long-press progress ring, a leaf sprout on a new flag and a soft
 * dust puff when a tile turns over. Each effect animates itself once on mount — re-key to replay.
 */

/** 180 ms radial ripple from the fingertip (shown even when the touch does nothing). */
export function TouchRipple({ x, y, size }: { x: number; y: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [t]);
  const d = size + 24;
  const st = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - t.value * t.value), transform: [{ scale: 0.25 + t.value * 0.75 }] }));
  return <Animated.View pointerEvents="none" style={[styles.ripple, { left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2 }, st]} />;
}

/** Radial fill around a held tile: when it closes, the hold becomes a flag. */
export const HoldRing = memo(function HoldRing({ x, y, size, progress }: { x: number; y: number; size: number; progress: SharedValue<number> }) {
  const r = size * 0.5 + 4;
  const box = r * 2 + 12;
  const path = useMemo(() => Skia.PathBuilder.Make().addCircle(box / 2, box / 2, r).detach(), [box, r]);
  const st = useAnimatedStyle(() => ({ opacity: progress.value < 0.3 ? 0 : 1 }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x - box / 2, top: y - box / 2, width: box, height: box }, st]}>
      <Canvas style={{ width: box, height: box }}>
        <Path path={path} style="stroke" strokeWidth={6} color="rgba(255,250,236,0.75)" />
        <Group origin={{ x: box / 2, y: box / 2 }} transform={[{ rotate: -Math.PI / 2 }]}>
          <Path path={path} style="stroke" strokeWidth={5} strokeCap="round" color="#E0882A" start={0} end={progress} />
        </Group>
      </Canvas>
    </Animated.View>
  );
});

/** Starts / stops the hold-ring fill in step with the long-press delay. */
export function runHold(progress: SharedValue<number>, ms: number) {
  progress.value = 0;
  progress.value = withTiming(1, { duration: ms, easing: Easing.linear });
}
export function stopHold(progress: SharedValue<number>) {
  cancelAnimation(progress);
  progress.value = withTiming(0, { duration: 90 });
}

/** One leaf thrown out of a sprouting flag: flies, tumbles and fades in ~380 ms. */
function LeafBit({ a, dist, size, delay, flip }: { a: number; dist: number; size: number; delay: number; flip: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }));
  }, [t, delay]);
  const st = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : t.value < 0.6 ? 1 : 1 - (t.value - 0.6) / 0.4,
    transform: [
      { translateX: Math.cos(a) * dist * t.value },
      { translateY: Math.sin(a) * dist * t.value - 10 * t.value + 8 * t.value * t.value },
      { rotate: `${a + (flip ? -1 : 1) * t.value * 3}rad` },
      { scale: 0.5 + Math.min(1, t.value * 3) * 0.5 },
    ],
  }));
  return <Animated.Image source={art.icon_reward_leaf} resizeMode="contain" style={[{ position: "absolute", left: -size / 2, top: -size / 2, width: size, height: size }, st]} />;
}

/** Soft cream puff at the foot of a new flag (the card's paper dust), ~200 ms. */
function SproutPuff({ size, delay }: { size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
  }, [t, delay]);
  const d = size * 1.05;
  const st = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 0 : 0.75 * (1 - t.value), transform: [{ scale: 0.35 + t.value * 0.8 }] }));
  return <Animated.View style={[styles.puff, { left: -d / 2, top: -d / 2 + size * 0.12, width: d, height: d * 0.7, borderRadius: d / 2, backgroundColor: "rgba(255,246,226,0.95)" }, st]} />;
}

/** Soft sparkle (fx_sparkle_soft) that blooms over a freshly planted flag and fades. */
function FlagSparkle({ size, delay }: { size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
  }, [t, delay]);
  const d = size * 1.15;
  const st = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 0 : 0.9 * (1 - t.value), transform: [{ scale: 0.4 + t.value * 0.8 }, { rotate: `${t.value * 40}deg` }] }));
  return <Animated.Image source={art.fx_sparkle_soft} resizeMode="contain" style={[{ position: "absolute", left: -d / 2, top: -d / 2, width: d, height: d }, st]} />;
}

/** A flag sprouting: a soft puff at its foot, a sparkle bloom and 7 leaves tossed out — all within 200 ms. */
export function FlagSpecks({ x, y, size, delay = 0 }: { x: number; y: number; size: number; delay?: number }) {
  const leaves = useMemo(
    () => Array.from({ length: 7 }, (_, k) => ({ a: -Math.PI / 2 + ((k - 3) / 3) * Math.PI * 0.85 + (Math.random() - 0.5) * 0.3, dist: size * (0.55 + Math.random() * 0.35), delay: delay + (k % 2 ? 30 : 0), flip: k % 2 === 0 })),
    [size, delay],
  );
  const leaf = Math.max(9, Math.round(size * 0.24));
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: y }}>
      <SproutPuff size={size} delay={delay} />
      <FlagSparkle size={size} delay={delay} />
      {leaves.map((l, k) => <LeafBit key={k} a={l.a} dist={l.dist} size={leaf} delay={l.delay} flip={l.flip} />)}
    </View>
  );
}

/** Dust puff as a tile turns over (bigger and warmer for the burst pod). */
export function DustPuff({ x, y, size, delay, burst }: { x: number; y: number; size: number; delay: number; burst?: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: burst ? 520 : 340, easing: Easing.out(Easing.cubic) }));
  }, [t, delay, burst]);
  const d = size * (burst ? 1.9 : 1.1);
  const st = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 0 : (burst ? 0.7 : 0.45) * (1 - t.value), transform: [{ scale: 0.5 + t.value * 0.7 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.puff, { left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: burst ? "rgba(214,120,90,0.55)" : "rgba(236,218,186,0.9)" }, st]}
    />
  );
}

const styles = StyleSheet.create({
  ripple: { position: "absolute", borderWidth: 3, borderColor: "rgba(255,250,236,0.95)", backgroundColor: "rgba(255,246,222,0.18)" },
  puff: { position: "absolute" },
});
