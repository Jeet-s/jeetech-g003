import { useEffect, useMemo, memo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Canvas, Group, Image, useImage, type SkImage } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { art } from "../art";

interface L { x: number; delay: number; speed: number; sway: number; phase: number; spin: number; size: number; alpha: number }

function LeafP({ l, t, img, h }: { l: L; t: SharedValue<number>; img: SkImage; h: number }) {
  const transform = useDerivedValue(() => {
    const k = Math.max(0, t.value - l.delay);
    const y = -60 + k * l.speed * h;
    const x = l.x + Math.sin(l.phase + k * 3.2) * l.sway;
    return [{ translateX: x }, { translateY: y }, { rotate: l.phase + k * l.spin }];
  });
  const opacity = useDerivedValue(() => {
    const k = t.value - l.delay;
    if (k <= 0) return 0;
    return l.alpha * Math.min(1, k * 4) * Math.max(0, 1 - Math.max(0, k - 1.4) / 0.6);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Image image={img} x={-l.size / 2} y={-l.size / 2} width={l.size} height={l.size} fit="contain" />
    </Group>
  );
}

// The leaf is decoded once for the app's lifetime — a fresh SkImage per win would pile up native memory.
let leafImage: SkImage | null = null;

/** Win celebration: low-density leaf confetti drifting down with sway and rotation (art: icon_reward_leaf). */
export const LeafConfetti = memo(function LeafConfetti({ trigger, count = 26 }: { trigger: number; count?: number }) {
  const { width, height } = useWindowDimensions();
  const loaded = useImage(leafImage ? null : art.icon_reward_leaf);
  if (loaded && !leafImage) leafImage = loaded;
  const img = leafImage ?? loaded;
  const t = useSharedValue(3);
  const leaves = useMemo<L[]>(
    () =>
      Array.from({ length: count }, () => ({
        x: Math.random() * width,
        delay: Math.random() * 0.7,
        speed: 0.45 + Math.random() * 0.35,
        sway: 14 + Math.random() * 26,
        phase: Math.random() * 6.28,
        spin: (Math.random() - 0.5) * 4,
        size: 18 + Math.random() * 18,
        alpha: 0.55 + Math.random() * 0.35,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger, count, width],
  );
  useEffect(() => {
    if (!trigger) return;
    t.value = 0;
    t.value = withTiming(3, { duration: 3000, easing: Easing.linear });
  }, [trigger, t]);
  if (!img) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {leaves.map((l, i) => (
        <LeafP key={i} l={l} t={t} img={img} h={height} />
      ))}
    </Canvas>
  );
});
