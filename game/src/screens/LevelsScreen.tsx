import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Background, CurrencyPill, GameButton, LevelMap, TopBar, type MapLevel } from "../ui";
import { store } from "../modules/store";
import { CHAPTERS, LEVELS } from "../game/levels";
import { levelId } from "../game/session";
import { useBannerHeight } from "../modules/layout";

/** The level map (from Home's "Levels" token): six chapters of fields winding up the page. */
export function LevelsScreen({ onPlay, onBack }: { onPlay: (levelNumber: number) => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const leaving = useSharedValue(0);
  const leaveStyle = useAnimatedStyle(() => ({ opacity: 1 - leaving.value * 0.55, transform: [{ scale: 1 + leaving.value * 0.04 }] }));
  const play = (n: number) => {
    leaving.value = withTiming(1, { duration: 160 });
    onPlay(n);
  };
  const bannerH = useBannerHeight();
  const [s, setS] = useState(store.get());
  useEffect(() => store.subscribe(setS), []);
  const stars = s.stars ?? {};
  const current = Math.min(LEVELS.length, Math.max(1, s.level));
  const levels: MapLevel[] = LEVELS.map((l) => ({
    id: levelId(l.number),
    number: l.number,
    chapter: `Chapter ${l.chapter} · ${l.chapterName}`,
    chapterSub: CHAPTERS[l.chapter - 1].blurb,
    stars: l.number < current || stars[levelId(l.number)] !== undefined ? stars[levelId(l.number)] ?? 1 : l.number === current ? 0 : -1,
  }));
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  return (
    <Animated.View style={[styles.root, leaveStyle]}>
      <Background />
      <LevelMap levels={levels} current={current} onSelect={(l) => play(l.number)} padTop={insets.top + 130} padBottom={insets.bottom + bannerH + 130} />
      <LinearGradient pointerEvents="none" colors={["rgba(240,224,198,1)", "rgba(240,224,198,0.9)", "rgba(240,224,198,0)"]} locations={[0, 0.6, 1]} style={[styles.scrimTop, { height: insets.top + 140 }]} />
      <LinearGradient pointerEvents="none" colors={["rgba(232,212,180,0)", "rgba(232,212,180,0.85)", "rgba(232,212,180,1)"]} style={[styles.scrimBottom, { height: insets.bottom + bannerH + 130 }]} />
      <View style={styles.top} pointerEvents="box-none">
        <TopBar title="Levels" subtitle={`${totalStars} / ${LEVELS.length * 3} stars`} onBack={onBack} backIcon="home" right={<View />} />
        <View style={styles.pills} pointerEvents="none">
          <CurrencyPill icon="star" value={totalStars} />
          <CurrencyPill icon="leaf" value={s.coins} />
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + bannerH + 16 }]} pointerEvents="box-none">
        <GameButton label={`Play · Level ${current}`} variant="accent" size="lg" style={{ flex: 1 }} sound="whoosh" onPress={() => play(current)} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: "absolute", left: 0, right: 0, top: 0 },
  pills: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 6 },
  scrimTop: { position: "absolute", left: 0, right: 0, top: 0 },
  scrimBottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bottom: { position: "absolute", left: 22, right: 22, bottom: 0, flexDirection: "row", alignItems: "center" },
});
