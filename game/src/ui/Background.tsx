import { memo, useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { Canvas, Rect, RadialGradient, vec } from "@shopify/react-native-skia";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { art, type ArtId } from "../art";
import { Leaf } from "./Art";

export type FieldTheme = "paper" | "garden" | "night";
export const THEME_ART: Record<FieldTheme, ArtId> = { paper: "bg_parchment_cozy", garden: "bg_garden_wood", night: "bg_night_sky" };

/** One slow-drifting leaf shadow (1-2% motion for life, never distraction). */
function DriftLeaf({ x, y, size, delay, rot }: { x: number; y: number; size: number; delay: number; rot: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 5200 + delay, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, delay]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x + t.value * 10 }, { translateY: y + t.value * 6 }, { rotate: `${rot + t.value * 8}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, opacity: 0.16 }, st]}>
      <Leaf size={size} />
    </Animated.View>
  );
}

/** A soft star that twinkles on the night sky. */
function TwinkleDot({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1600 + delay, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [t, delay]);
  const st = useAnimatedStyle(() => ({ opacity: 0.15 + t.value * 0.75, transform: [{ scale: 0.7 + t.value * 0.5 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: "#FFF4D6", shadowColor: "#FFE9B0", shadowOpacity: 0.9, shadowRadius: 4 }, st]} />;
}

const STARS = [[0.08, 0.06, 3, 0], [0.22, 0.14, 2, 500], [0.4, 0.04, 2.5, 900], [0.63, 0.1, 3, 300], [0.86, 0.05, 2, 1200], [0.93, 0.2, 2.5, 700], [0.05, 0.42, 2, 1500], [0.95, 0.5, 2, 200], [0.1, 0.86, 2.5, 1000], [0.9, 0.9, 3, 600]];

/** Soft oval vignette over the theme art — memoised: it only redraws when the window or the theme changes. */
const Vignette = memo(function Vignette({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height * 0.45)}
          r={Math.max(width, height) * 0.75}
          colors={dark ? ["rgba(0,0,0,0)", "rgba(4,8,20,0.45)"] : ["rgba(255,250,240,0.10)", "rgba(110,72,30,0.22)"]}
        />
      </Rect>
    </Canvas>
  );
});

/**
 * Full-screen field background: the chapter/theme art (parchment, garden table, night sky) with a
 * soft oval vignette; `leaves` adds a few drifting leaf shadows (title screen, menus).
 */
export function Background({ theme = "paper", leaves, children }: { theme?: FieldTheme; leaves?: boolean; children?: React.ReactNode; colors?: [string, string] }) {
  const { width, height } = useWindowDimensions();
  const dark = theme === "night";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={art[THEME_ART[theme]]} resizeMode="cover" style={{ position: "absolute", left: 0, top: 0, width, height }} />
      <Vignette width={width} height={height} dark={dark} />
      {leaves && !dark ? (
        <>
          <DriftLeaf x={width * 0.04} y={height * 0.2} size={58} delay={0} rot={-30} />
          <DriftLeaf x={width * 0.8} y={height * 0.12} size={42} delay={900} rot={40} />
          <DriftLeaf x={width * 0.86} y={height * 0.62} size={50} delay={400} rot={110} />
        </>
      ) : null}
      {dark ? STARS.map(([x, y, sz, d], i) => <TwinkleDot key={i} x={x * width} y={y * height} size={sz} delay={d} />) : null}
      {children}
    </View>
  );
}
