import { memo, useEffect, useMemo, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Canvas, Group, Path, Skia, DashPathEffect, type SkPath } from "@shopify/react-native-skia";
import Animated, { cancelAnimation, FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MiniStars } from "./Stars";
import { fonts, palette, shadow } from "./theme";
import { feedback } from "../audio/sfx";
import { art } from "../art";
import { Icon } from "./Icon";
import { Sprite } from "./Art";

const NODE = 70;
const GAP = 112;
const BANNER_GAP = 92; // extra room where a chapter starts, so its banner never covers a node
// The path is drawn in canvas tiles: one canvas the map's full height exceeds the GPU texture limit and draws blank.
const TILE = 2000;

export interface MapLevel {
  id: string;
  number: number;
  stars: number; // 0-3, -1 = locked
  chapter?: string; // shown as a banner where it changes
  chapterSub?: string;
}

/** The pin on the current field sways gently so the map is never static. */
function SwayPin() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1300 }), -1, true);
    return () => cancelAnimation(t);
  }, [t]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${2 + t.value * 12}deg` }, { translateY: -t.value * 3 }] }));
  return (
    <Animated.View style={[styles.flagPin, st]} pointerEvents="none">
      <Sprite id="tile_flag_fabric" width={30} />
    </Animated.View>
  );
}

function Pulse() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withSequence(withTiming(1.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => cancelAnimation(s);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 2 - s.value * 1.2 }));
  return <Animated.View style={[styles.pulse, style]} />;
}

/**
 * Candy-style winding level map (bottom = level 1). Done levels show stars,
 * the current level pulses, future levels are locked.
 */
/** The dotted trail between nodes, in canvas tiles of at most TILE dp — memoised on its path and size. */
const MapPath = memo(function MapPath({ path, width, height }: { path: SkPath; width: number; height: number }) {
  return (
    <>
      {Array.from({ length: Math.ceil(height / TILE) }, (_, k) => (
        <Canvas key={k} style={{ position: "absolute", left: 0, top: k * TILE, width, height: Math.min(TILE, height - k * TILE) }} pointerEvents="none">
          <Group transform={[{ translateY: -k * TILE }]}>
            <Path path={path} style="stroke" strokeWidth={22} color="rgba(120,82,40,0.16)" strokeCap="round" />
            <Path path={path} style="stroke" strokeWidth={8} color="rgba(255,250,238,0.85)" strokeCap="round">
              <DashPathEffect intervals={[3, 18]} />
            </Path>
          </Group>
        </Canvas>
      ))}
    </>
  );
});

export function LevelMap({
  levels,
  current,
  onSelect,
  header,
  padTop = 120,
  padBottom = 200,
}: {
  levels: MapLevel[];
  current: number;
  onSelect: (l: MapLevel) => void;
  header?: React.ReactNode;
  padTop?: number; // space covered by the HUD
  padBottom?: number; // space covered by the bottom buttons
}) {
  const { width, height: winH } = useWindowDimensions();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { pos, height } = useMemo(() => {
    // Distance of each node above the bottom of the map; chapter starts get extra room for their banner.
    let up = 0;
    const offs = levels.map((l, i) => {
      if (i > 0) up += GAP;
      if (l.chapter && l.chapter !== levels[i - 1]?.chapter) up += BANNER_GAP;
      return up;
    });
    const h = padBottom + NODE / 2 + up + NODE / 2 + padTop;
    return {
      height: Math.max(h, winH),
      pos: offs.map((o, i) => ({ x: width / 2 + Math.sin(i * 0.9) * (width * 0.28), y: Math.max(h, winH) - padBottom - NODE / 2 - o })),
    };
  }, [levels, width, winH, padTop, padBottom]);
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    pos.forEach((q, i) => {
      if (i === 0) b.moveTo(q.x, q.y);
      else {
        const prev = pos[i - 1];
        b.cubicTo(prev.x, prev.y - GAP / 2, q.x, q.y + GAP / 2, q.x, q.y);
      }
    });
    return b.detach();
  }, [pos]);
  useEffect(() => {
    // Centre the current level in the visible band between the HUD and the bottom buttons.
    const y = pos[Math.max(0, current - 1)]?.y ?? 0;
    const target = Math.min(height - winH, Math.max(0, y - (padTop + (winH - padTop - padBottom) / 2)));
    const id = setTimeout(() => scroll.current?.scrollTo({ y: target, animated: false }), 50);
    return () => clearTimeout(id);
  }, [current, pos, height, winH, padTop, padBottom]);

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ height }} showsVerticalScrollIndicator={false}>
      {header}
      <MapPath path={path} width={width} height={height} />
      {levels.map((l, i) => {
        const locked = l.stars < 0;
        const isCurrent = l.number === current;
        const showBanner = l.chapter && l.chapter !== levels[i - 1]?.chapter;
        return (
          <View key={l.id}>
            {showBanner ? (
              <View style={[styles.banner, { top: pos[i].y + NODE / 2 + (GAP + BANNER_GAP - NODE) / 2 - 26 }]}>
                <View style={styles.bannerInner}>
                  <Text style={styles.bannerText}>{l.chapter}</Text>
                  {l.chapterSub ? <Text style={styles.bannerSub}>{l.chapterSub}</Text> : null}
                </View>
              </View>
            ) : null}
            <Animated.View
              // Map entry: the fields around you pop in first, rippling outwards along the path.
              entering={Math.abs(l.number - current) <= 6 ? ZoomIn.delay(80 + Math.abs(l.number - current) * 55).springify().damping(12) : FadeIn.duration(200)}
              style={[styles.nodeSlot, { left: pos[i].x - NODE / 2, top: pos[i].y - NODE / 2 }]}
            >
            <Pressable
              disabled={locked}
              onPress={() => {
                feedback("pop", "medium");
                onSelect(l);
              }}
              style={({ pressed }) => [
                styles.nodeWrap,
                { transform: [{ scale: pressed ? 0.92 : isCurrent ? 1.08 : 1 }] },
              ]}
            >
              {isCurrent ? <Pulse /> : null}
              <View style={[styles.lip, { backgroundColor: locked ? "#BFA98A" : isCurrent ? palette.goldDark : "#B39466" }]} />
              <View style={[styles.node, { opacity: locked ? 0.72 : 1 }, shadow]}>
                <Image source={art.tile_hidden_card} style={styles.nodeImg} resizeMode="stretch" />
                {isCurrent ? <LinearGradient colors={["rgba(255,216,119,0.75)", "rgba(242,174,52,0.85)"]} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} /> : null}
                {locked ? (
                  <Icon name="lock" size={28} color="#9C8463" />
                ) : (
                  <Text style={[styles.num, { color: isCurrent ? "#FFFBEF" : palette.brown }, isCurrent && styles.numCurrent]}>{l.number}</Text>
                )}
              </View>
              {isCurrent ? <SwayPin /> : null}
              {!locked && !isCurrent ? <MiniStars count={l.stars} /> : null}
            </Pressable>
            </Animated.View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nodeSlot: { position: "absolute", width: NODE },
  nodeWrap: { width: NODE, alignItems: "center" },
  node: { width: NODE, height: NODE, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  nodeImg: { position: "absolute", left: 0, top: 0, width: NODE, height: NODE },
  lip: { position: "absolute", top: 5, width: NODE - 4, left: 2, height: NODE, borderRadius: 18 },
  num: { fontFamily: fonts.display, fontSize: 27 },
  numCurrent: { textShadowColor: "rgba(150,90,10,0.6)", textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 1 },
  flagPin: { position: "absolute", top: -26, right: -8 },
  pulse: { position: "absolute", width: NODE + 26, height: NODE + 26, top: -13, borderRadius: 30, backgroundColor: "rgba(244,190,69,0.4)" },
  banner: { position: "absolute", alignSelf: "center", backgroundColor: palette.woodDark, borderRadius: 16, padding: 3, ...shadow },
  bannerInner: { backgroundColor: palette.wood, borderRadius: 13, paddingHorizontal: 22, paddingVertical: 6, alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,230,190,0.45)" },
  bannerText: { fontFamily: fonts.display, fontSize: 18, color: "#FFF6E4", textShadowColor: "rgba(80,45,15,0.6)", textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 1 },
  bannerSub: { fontFamily: fonts.bodyRegular, fontSize: 12, color: "#FBE7C8" },
});
