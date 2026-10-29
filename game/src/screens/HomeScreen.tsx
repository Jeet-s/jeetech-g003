import { memo, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Canvas, Circle, RadialGradient, vec, Oval } from "@shopify/react-native-skia";
import Animated, { cancelAnimation,
  Easing, FadeInDown, FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { Background, CurrencyPill, GameButton, IconButton, Leaf, Sprite, fonts, palette } from "../ui";
import { art } from "../art";
import { store } from "../modules/store";
import { CHAPTERS, LEVELS } from "../game/levels";
import { dayKey } from "../game/session";
import { useBannerHeight } from "../modules/layout";

/**
 * HOME = the title screen. Logo, the cozy-field key art with idle life (it bobs, leaves drift, the
 * sun glows, sparkles twinkle), where you are (chapter + progress) and ONE big "Play · Level N".
 * Levels (map), Free Play, Shop and Settings are secondary tokens.
 */
export function HomeScreen({ onPlay, onLevels, onFreePlay, onShop, onSettings }: {
  onPlay: (levelNumber: number) => void;
  onLevels: () => void;
  onFreePlay: () => void;
  onShop: () => void;
  onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bannerH = useBannerHeight();
  const { width, height } = useWindowDimensions();
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const allDone = s.level > LEVELS.length;
  const current = Math.min(LEVELS.length, Math.max(1, s.level));
  const ch = LEVELS[current - 1].chapter;
  const inChapter = LEVELS.filter((l) => l.chapter === ch);
  const doneInChapter = inChapter.filter((l) => (s.stars ?? {})[`L${l.number}`] !== undefined).length;
  const totalStars = Object.values(s.stars ?? {}).reduce((a, b) => a + b, 0);
  const dailyLeft = 3 - ((s.daily ?? {})[dayKey()]?.length ?? 0);

  const float = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 800 })), -1));
    return () => { cancelAnimation(float); cancelAnimation(breathe); };
  }, [float, breathe]);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -3 + float.value * 6 }] }));
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 6 - float.value * 12 }, { rotate: `${-0.8 + float.value * 1.6}deg` }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: 0.92 + float.value * 0.1 }], opacity: 0.55 + float.value * 0.25 }));
  const playStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.03 }] }));

  const compact = height < 700;
  const logoW = Math.min(width * 0.84, 420);
  const heroW = Math.min(width * (compact ? 0.56 : 0.68), compact ? 240 : 320);
  const heroH = heroW * (512 / 445);

  return (
    <View style={styles.root}>
      <Background leaves />
      <View style={[styles.hud, { paddingTop: insets.top + 10 }]}>
        <CurrencyPill icon="star" value={totalStars} />
        <CurrencyPill icon="leaf" value={s.coins} />
      </View>

      <Animated.View entering={FadeInDown.duration(500)}>
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image source={art.logo} style={{ width: logoW, height: logoW * (455 / 900) }} resizeMode="contain" accessibilityLabel="Minesweeper Offline: Cozy Fields" />
          <Text style={styles.tagline}>Cozy Fields · big tiles, fair boards</Text>
        </Animated.View>
      </Animated.View>

      <View style={styles.heroArea} pointerEvents="none">
        <View style={{ width: heroW, height: heroH + 24, alignItems: "center" }}>
          <HeroGlow heroW={heroW} heroH={heroH} />
          <Animated.View style={[styles.groundShadow, { width: heroW * 0.8, top: heroH - 18 }, shadowStyle]}>
            <GroundShadow heroW={heroW} />
          </Animated.View>
          <Animated.View style={heroStyle}>
            <Image source={art.hero_key_art_cozy_field} style={{ width: heroW, height: heroH }} resizeMode="contain" />
          </Animated.View>
          <FloatLeaf x={-heroW * 0.08} y={heroH * 0.18} size={30} delay={0} />
          <FloatLeaf x={heroW * 0.9} y={heroH * 0.06} size={24} delay={700} />
          <FloatLeaf x={heroW * 0.86} y={heroH * 0.62} size={28} delay={1300} />
          <Twinkle x={heroW * 0.1} y={heroH * 0.55} size={30} delay={300} />
          <Twinkle x={heroW * 0.72} y={heroH * 0.3} size={24} delay={1500} />
          <Twinkle x={heroW * 0.4} y={-10} size={20} delay={900} />
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + bannerH + 14 }]}>
        <Animated.View entering={FadeInUp.delay(150).duration(450)} style={styles.chapter}>
          <View style={styles.chapterLine}>
            <View style={styles.rule} />
            <Text style={styles.chapterLabel}>{allDone ? "All chapters cleared" : `Chapter ${ch} · ${CHAPTERS[ch - 1].name}`}</Text>
            <View style={styles.rule} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(5, (doneInChapter / inChapter.length) * 100)}%` }]} />
          </View>
          <Text style={styles.chapterCount}>
            {doneInChapter}/{inChapter.length} fields · {CHAPTERS[ch - 1].blurb}
          </Text>
        </Animated.View>

        <Animated.View entering={ZoomIn.delay(250).duration(380)}>
          <Animated.View style={playStyle}>
            <GameButton
              label={allDone ? "Play · Free Play" : `Play · Level ${current}`}
              variant="accent"
              size="lg"
              sound="whoosh"
              onPress={() => (allDone ? onFreePlay() : onPlay(current))}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(450)} style={styles.iconRow}>
          <IconButton icon="map" label="Levels" onPress={onLevels} size={58} />
          <IconButton icon="calendar" label="Daily" onPress={onFreePlay} size={58} badge={dailyLeft > 0 ? dailyLeft : undefined} />
          <IconButton icon="shop" label="Shop" onPress={onShop} size={58} />
          <IconButton icon="settings" label="Settings" onPress={onSettings} size={58} />
        </Animated.View>
      </View>
    </View>
  );
}

/** Warm sunlit halo behind the key art (memoised: static unless the window size changes). */
const HeroGlow = memo(function HeroGlow({ heroW, heroH }: { heroW: number; heroH: number }) {
  return (
    <Canvas style={{ position: "absolute", left: -heroW * 0.4, top: heroH * 0.5 - heroW * 0.9, width: heroW * 1.8, height: heroW * 1.8 }}>
      <Circle cx={heroW * 0.9} cy={heroW * 0.9} r={heroW * 0.9}>
        <RadialGradient c={vec(heroW * 0.9, heroW * 0.9)} r={heroW * 0.9} colors={["rgba(255,240,200,0.9)", "rgba(255,240,200,0)"]} />
      </Circle>
    </Canvas>
  );
});

/** Soft oval shadow under the key art. */
const GroundShadow = memo(function GroundShadow({ heroW }: { heroW: number }) {
  return (
    <Canvas style={{ width: heroW * 0.8, height: 30 }}>
      <Oval x={0} y={0} width={heroW * 0.8} height={30}>
        <RadialGradient c={vec(heroW * 0.4, 15)} r={heroW * 0.4} colors={["rgba(110,70,30,0.35)", "rgba(110,70,30,0)"]} />
      </Oval>
    </Canvas>
  );
});

function FloatLeaf({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [t, delay]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * t.value }, { translateX: 6 * t.value }, { rotate: `${-20 + 40 * t.value}deg` }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: x, top: y, opacity: 0.9 }, st]}>
      <Leaf size={size} />
    </Animated.View>
  );
}

function Twinkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 900 }), withTiming(0, { duration: 1200 })), -1));
    return () => cancelAnimation(t);
  }, [t, delay]);
  const st = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.6 + t.value * 0.4 }, { rotate: `${t.value * 30}deg` }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: x, top: y }, st]}>
      <Sprite id="fx_sparkle_soft" width={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { flexDirection: "row", justifyContent: "center", gap: 18, paddingHorizontal: 16 },
  logoWrap: { marginTop: 10, alignItems: "center" },
  tagline: { fontFamily: fonts.body, fontSize: 14, color: palette.brown, opacity: 0.8, marginTop: -4 },
  heroArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  groundShadow: { position: "absolute", height: 30 },
  bottom: { paddingHorizontal: 26, gap: 14 },
  chapter: { alignItems: "center", gap: 6 },
  chapterLine: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch" },
  rule: { flex: 1, height: 2, borderRadius: 1, backgroundColor: "rgba(140,100,55,0.3)" },
  chapterLabel: { fontFamily: fonts.display, fontSize: 18, color: palette.brown },
  progressTrack: { width: "72%", height: 12, borderRadius: 6, backgroundColor: "rgba(160,120,70,0.2)", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  progressFill: { height: "100%", borderRadius: 6, backgroundColor: palette.sage },
  chapterCount: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft },
  iconRow: { flexDirection: "row", justifyContent: "center", gap: 18 },
});
