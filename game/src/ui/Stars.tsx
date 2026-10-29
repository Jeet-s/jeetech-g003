import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { play, haptic } from "../audio/sfx";
import { StarGlyph, StarRow } from "./Icon";

function Star({ on, index, animate, size }: { on: boolean; index: number; animate: boolean; size: number }) {
  const s = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    const delay = 250 + index * 320;
    s.value = 0;
    const pop = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(2.6)) });
    // Earned stars keep a slow, warm "breath" while the card is up.
    s.value = withDelay(delay, on ? withSequence(pop, withRepeat(withSequence(withTiming(1.07, { duration: 850 }), withTiming(1, { duration: 850 })), -1)) : pop);
    if (!on) return () => cancelAnimation(s);
    const id = setTimeout(() => {
      play(`star${index + 1}` as "star1");
      haptic("medium");
    }, delay + 120);
    return () => { clearTimeout(id); cancelAnimation(s); };
  }, [animate, index, on, s]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }, { rotate: `${Math.max(0, 1 - s.value) * -40}deg` }, { translateY: index === 1 ? -12 : 0 }],
  }));
  return (
    <Animated.View style={[styles.star, style]}>
      <StarGlyph size={index === 1 ? size * 1.25 : size} on={on} />
    </Animated.View>
  );
}

/** Three-star award with staggered pop + rising chimes. `animate` for the win screen. */
export function Stars({ count, animate = false, size = 48 }: { count: number; animate?: boolean; size?: number }) {
  return (
    <View style={styles.row}>
      {[0, 1, 2].map((i) => (
        <Star key={i} index={i} on={i < count} animate={animate} size={size} />
      ))}
    </View>
  );
}

/** Small static stars under level nodes. */
export function MiniStars({ count, size = 15 }: { count: number; size?: number }) {
  return (
    <View style={styles.mini}>
      <StarRow count={count} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 6, marginVertical: 8 },
  star: { alignItems: "center", justifyContent: "center" },
  mini: { flexDirection: "row", gap: 0, marginTop: 2 },
});
