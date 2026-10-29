import { useEffect, useLayoutEffect, useState } from "react";
import { Linking, Platform, Settings, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { HomeScreen } from "./screens/HomeScreen";
import { LevelsScreen } from "./screens/LevelsScreen";
import { GameScreen } from "./screens/GameScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { FreePlayScreen } from "./screens/FreePlayScreen";
import type { Session } from "./game/session";
import { SettingsPopup, initAudio } from "./ui";
import { analytics } from "./modules/analytics";
import { layout } from "./modules/layout";
import { ads } from "./modules/ads";
import { iap } from "./modules/iap";
import { store } from "./modules/store";
import { ScreenshotScene } from "./screenshots";
import { qa } from "./modules/qa";
import { LEVELS } from "./game/levels";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Same privacy policy the store listing links (Play User Data policy: reachable from the app too). */
const PRIVACY_URL = "https://jeet-s.github.io/jeetech-g003/privacy.html";

/**
 * Root of the premium runtime. Boot order matters: fonts → player state →
 * audio → consent + ads → billing. The builder adds screens/flows but keeps
 * this shell: providers, fonts, the banner slot and screenshot mode.
 */
export default function App() {
  const [fontsLoaded] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold, Nunito_600SemiBold, Nunito_700Bold });
  // Screenshot mode (<scheme>://shot/<id>): render a store-screenshot scene
  // without ads or billing. undefined = still checking the launch URL.
  const [shot, setShot] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    // iOS: the factory launches with `-AGFShot <id>` (a deep link would trigger an "Open in …?" prompt).
    const arg = Platform.OS === "ios" ? Settings.get("AGFShot") : null;
    if (typeof arg === "string" && /^[\w-]+$/.test(arg)) {
      setShot(arg);
      return;
    }
    Linking.getInitialURL()
      .then((u) => {
        // QA level replay (<scheme>://qa/level/<n>, src/modules/qa.ts): straight into level n.
        const lv = Number(u?.match(/qa\/level\/(\d+)/)?.[1] ?? NaN);
        if (Number.isFinite(lv) && lv > 0 && lv <= LEVELS.length) qa.level = lv;
        setShot(u?.match(/shot\/([\w-]+)/)?.[1] ?? null);
      })
      .catch(() => setShot(null));
  }, []);
  const ready = fontsLoaded && shot !== undefined;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return <View style={styles.root} />;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {shot ? <ScreenshotScene id={shot} /> : <Game />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Game() {
  const [booted, setBooted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [screen, setScreen] = useState<{ name: "home" } | { name: "levels" } | { name: "game"; session: Session; key: string }>(
    qa.level ? { name: "game", session: { kind: "level", level: qa.level }, key: `L${qa.level}` } : { name: "home" },
  );
  const [freeOpen, setFreeOpen] = useState(false);
  const playLevel = (level: number) => setScreen({ name: "game", session: { kind: "level", level }, key: `L${level}` });
  const playFree = (session: Session) => {
    setFreeOpen(false);
    setScreen({ name: "game", session, key: `F${Date.now()}` });
  };
  const [shopOpen, setShopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // iOS: the banner sits above the home indicator; screens already add insets.bottom themselves.
  const insets = useSafeAreaInsets();
  const bannerInset = Platform.OS === "ios" ? insets.bottom : 0;

  useEffect(() => {
    (async () => {
      await store.load();
      analytics.track("app_open");
      setBooted(true);
      await initAudio();
      if (qa.level) return; // QA replay: no ads, no billing — nothing may cover the board
      await ads.init();
      setShowBanner(ads.canShowBanner());
      await iap.init();
    })();
    return store.subscribe(() => setShowBanner(!qa.level && ads.canShowBanner()));
  }, []);
  useEffect(() => {
    if (!showBanner) layout.setBannerHeight(0);
  }, [showBanner]);

  if (!booted) return <View style={styles.root} />;
  return (
    <View style={styles.root}>
      <ScreenFade id={screen.name === "game" ? `game-${screen.key}` : screen.name}>
        {screen.name === "home" ? (
          <HomeScreen
            onPlay={playLevel}
            onLevels={() => setScreen({ name: "levels" })}
            onFreePlay={() => setFreeOpen(true)}
            onShop={() => setShopOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        ) : screen.name === "levels" ? (
          <LevelsScreen onPlay={playLevel} onBack={() => setScreen({ name: "home" })} />
        ) : (
          <GameScreen
            key={screen.key}
            session={screen.session}
            onExit={() => setScreen(screen.session.kind === "level" ? { name: "levels" } : { name: "home" })}
            onSettings={() => setSettingsOpen(true)}
            onNextLevel={playLevel}
            onFreePlay={() => {
              setScreen({ name: "home" });
              setFreeOpen(true);
            }}
          />
        )}
      </ScreenFade>
      <FreePlayScreen visible={freeOpen} onClose={() => setFreeOpen(false)} onStart={playFree} />
      <ShopScreen visible={shopOpen} onClose={() => setShopOpen(false)} />
      <SettingsPopup visible={settingsOpen} onClose={() => setSettingsOpen(false)} privacyUrl={PRIVACY_URL} />
      {showBanner && (
        <View style={[styles.banner, bannerInset ? { paddingBottom: bannerInset } : null]} onLayout={(e) => layout.setBannerHeight(e.nativeEvent.layout.height - bannerInset)}>
          <BannerAd unitId={ads.bannerUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
        </View>
      )}
    </View>
  );
}

/**
 * Screen change: the new screen eases in from 35 % opacity — a stable container, never a keyed `entering` /
 * `exiting` layout animation (those stick blank on Android and skew QA touch positions) and never a fade from 0.
 */
function ScreenFade({ id, children }: { id: string; children: React.ReactNode }) {
  const o = useSharedValue(1);
  const [first] = useState(() => ({ id }));
  useLayoutEffect(() => {
    if (first.id === id) return; // the launch screen just appears
    first.id = "";
    o.value = 0.35;
    o.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [id, o, first]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.root, st]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EAD7B8" },
  banner: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
});
