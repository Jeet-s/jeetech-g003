import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle, type StyleProp } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, palette, radius, springs } from "./theme";
import { feedback, type Sfx } from "../audio/sfx";
import { NineSliceArt } from "./Art";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "accent" | "danger" | "light";

/** Gradient pills (honey gold / coral) for the variants the art set has no plate for. */
const GRADIENT: Partial<Record<Variant, { top: string; bottom: string; lip: string; text: string; shade: string }>> = {
  accent: { top: "#FFD877", bottom: "#F2AE34", lip: "#C98420", text: "#FFFBEF", shade: "rgba(150,90,10,0.55)" },
  danger: { top: "#F48A72", bottom: palette.danger, lip: palette.dangerDark, text: "#FFF8F2", shade: "rgba(120,40,20,0.5)" },
};

/**
 * Pill button. Primary = the sage-green art plate, light/secondary = the cream paper plate, accent =
 * a honey-gold pill (hero CTA), danger = coral. Spring squash on press, tap sound + haptic. Use for
 * EVERY labelled action.
 */
export function GameButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled,
  sound = "tap",
  style,
  sub,
}: {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  disabled?: boolean;
  sound?: Sfx;
  style?: StyleProp<ViewStyle>;
  sub?: React.ReactNode; // small trailing badge (price, count)
}) {
  const press = useSharedValue(0);
  const [w, setW] = useState(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 }, { scale: 1 - press.value * 0.05 }] }));
  const bright = useAnimatedStyle(() => ({ opacity: press.value * 0.22 }));
  const h = size === "lg" ? 68 : size === "sm" ? 46 : 56;
  const fs = size === "lg" ? 26 : size === "sm" ? 17 : 21;
  const g = GRADIENT[variant];
  const plate = variant === "primary" ? "button_primary_plate" : "button_secondary_plate";
  const textColor = g ? g.text : variant === "primary" ? "#FFFBF0" : palette.brown;
  const shade = g ? g.shade : variant === "primary" ? "rgba(40,60,30,0.55)" : "rgba(255,255,255,0.8)";
  return (
    <Pressable
      disabled={disabled}
      // Press answers within 80 ms: squash to 0.95 and brighten, spring back on release.
      onPressIn={() => (press.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (press.value = withSpring(0, springs.press))}
      onPress={() => {
        feedback(sound, "light");
        onPress?.();
      }}
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      // Disabled stays a solid plate (never see-through) — only its ink fades, so it can't read as a card overlay.
      style={[{ height: h + 6, minWidth: h }, style]}
      hitSlop={6}
    >
      <View style={[styles.shadow, { height: h, borderRadius: h / 2 }]} />
      <Animated.View style={[{ height: h }, face]}>
        {g ? (
          <>
            <View style={[StyleSheet.absoluteFill, { top: 5, bottom: -5, borderRadius: h / 2, backgroundColor: g.lip }]} />
            <LinearGradient colors={[g.top, g.bottom]} style={[StyleSheet.absoluteFill, { borderRadius: h / 2 }]} />
            <View style={[styles.shine, { borderRadius: h / 2 }]} />
          </>
        ) : w > 0 ? (
          <NineSliceArt id={plate} inset={variant === "primary" ? [108, 0, 108, 0] : [118, 0, 118, 0]} k={h / (variant === "primary" ? 217 : 263)} w={w} h={h} />
        ) : null}
        <View style={[styles.face, { paddingHorizontal: size === "sm" ? 16 : 24, opacity: disabled ? 0.42 : 1 }]}>
          {icon}
          {label ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.label, { color: textColor, fontSize: fs, textShadowColor: shade }]}
            >
              {label}
            </Text>
          ) : null}
          {sub}
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: h / 2, backgroundColor: "#FFFFFF" }, bright]} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Round ceramic token with an engraved icon (undo, hint, pause, map, shop, settings). ≥ 52dp target.
 * `badge` shows a small count (hints left, undo left).
 */
export function IconButton({ icon, onPress, size = 54, label, badge, disabled, active, sound = "tap", labelColor }: {
  icon: IconName; onPress: () => void; size?: number; label?: string; badge?: string | number; disabled?: boolean; active?: boolean; sound?: Sfx;
  labelColor?: string;
}) {
  const p = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: p.value * 2 }, { scale: 1 - p.value * 0.05 }] }));
  const bright = useAnimatedStyle(() => ({ opacity: p.value * 0.3 }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => (p.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (p.value = withSpring(0, springs.press))}
      onPress={() => {
        feedback(sound, "light");
        onPress();
      }}
      hitSlop={8}
      style={styles.token}
    >
      <View style={{ width: size, height: size + 4 }}>
        <View style={[styles.tokenLip, { width: size, height: size, borderRadius: size / 2 }]} />
        <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }, st]}>
          <LinearGradient colors={active ? ["#B4CD95", palette.sage] : ["#FFF9EE", "#EFDDBE"]} style={[StyleSheet.absoluteFill, styles.tokenFace]}>
            <View style={styles.tokenRim} />
            <View style={{ opacity: disabled ? 0.35 : 1 }}>
              <Icon name={icon} size={size * 0.48} color={active ? "#FFFBF0" : palette.brown} />
            </View>
          </LinearGradient>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF" }, bright]} />
        </Animated.View>
        {badge !== undefined ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {label ? <Text style={[styles.tokenLabel, labelColor ? { color: labelColor } : null, disabled ? { opacity: 0.5 } : null]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { position: "absolute", left: 4, right: 4, top: 8, backgroundColor: "rgba(90,59,28,0.18)" },
  face: { ...StyleSheet.absoluteFill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shine: { position: "absolute", top: 4, left: 14, right: 14, height: "36%", backgroundColor: "rgba(255,255,255,0.28)" },
  label: { fontFamily: fonts.display, letterSpacing: 0.4, textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 1 },
  token: { alignItems: "center", gap: 4, minWidth: 56 },
  tokenLip: { position: "absolute", top: 4, backgroundColor: "#C9AC82" },
  tokenFace: { alignItems: "center", justifyContent: "center" },
  tokenRim: { position: "absolute", left: 3, right: 3, top: 3, bottom: 3, borderRadius: 999, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)", borderBottomColor: "rgba(150,115,70,0.25)" },
  tokenLabel: { fontFamily: fonts.body, fontSize: 12, color: palette.brown },
  badge: { position: "absolute", right: -4, top: -4, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: palette.danger, borderWidth: 2, borderColor: "#FFF8EC", alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.display, fontSize: 12, color: "#fff" },
});
