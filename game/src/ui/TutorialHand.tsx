import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, withDelay } from "react-native-reanimated";
import { Icon } from "./Icon";
import { fonts, palette } from "./theme";

/**
 * Coaching pointer: a cream fingertip token that taps (or holds, for "hold to flag") at `from`,
 * with a ripple ring, or swipes from → to. Optional caption bubble under it.
 */
export function TutorialHand({ from, to, hold, caption, cell = 0 }: { from: { x: number; y: number }; to?: { x: number; y: number }; hold?: boolean; caption?: string; cell?: number }) {
  const t = useSharedValue(0);
  const ring = useSharedValue(0);
  useEffect(() => {
    const down = hold ? 700 : 260;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: down }), withTiming(0, { duration: 420, easing: Easing.inOut(Easing.cubic) }), withTiming(0, { duration: 300 })), -1);
    ring.value = withRepeat(withSequence(withDelay(480, withTiming(1, { duration: hold ? 900 : 520 })), withTiming(0, { duration: 0 }), withTiming(0, { duration: hold ? 560 : 780 })), -1);
    return () => { cancelAnimation(t); cancelAnimation(ring); };
  }, [t, ring, hold]);
  const style = useAnimatedStyle(() => {
    const dest = to ?? from;
    const x = from.x + (dest.x - from.x) * (to ? t.value : 0);
    const y = from.y + (dest.y - from.y) * (to ? t.value : 0);
    const lift = to ? 0 : (1 - t.value) * 26;
    // With a cell size the token sits off the lower-right corner so the target tile itself stays visible.
    return { transform: [{ translateX: x - 22 + cell * 0.42 }, { translateY: y - 10 + cell * 0.5 + lift }, { scale: 1 - 0.1 * t.value }] };
  });
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 ? 0.9 * (1 - ring.value) : 0,
    transform: [{ translateX: from.x - 24 }, { translateY: from.y - 24 }, { scale: 0.4 + ring.value * 0.9 }],
  }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <Animated.View pointerEvents="none" style={[styles.hand, style]}>
        <View style={styles.handShadow}>
          <Icon name="tap" size={40} color={palette.brown} weight={2.1} engraved={false} />
        </View>
      </Animated.View>
      {caption ? (
        <View pointerEvents="none" style={[styles.caption, { left: from.x - 70, top: from.y + 52 }]}>
          <Text style={styles.captionText}>{caption}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hand: { position: "absolute", left: 0, top: 0 },
  handShadow: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,250,240,0.92)", alignItems: "center", justifyContent: "center", shadowColor: "#5A3B1C", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  ring: { position: "absolute", left: 0, top: 0, width: 48, height: 48, borderRadius: 24, borderWidth: 4, borderColor: "#FFF6DF" },
  caption: { position: "absolute", width: 140, alignItems: "center", backgroundColor: palette.brown, borderRadius: 12, paddingVertical: 5 },
  captionText: { fontFamily: fonts.display, fontSize: 15, color: "#FFF8EA" },
});
