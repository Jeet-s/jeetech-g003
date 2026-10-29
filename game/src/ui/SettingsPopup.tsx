import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Popup } from "./Popup";
import { Toggle, Segmented } from "./Toggle";
import { GameButton } from "./GameButton";
import { store } from "../modules/store";
import { iap } from "../modules/iap";
import { fonts, palette } from "./theme";

/** Settings: sound, music, vibration, flag controls + accessibility, Remove Ads / Restore. */
export function SettingsPopup({ visible, onClose, privacyUrl }: { visible: boolean; onClose: () => void; privacyUrl?: string }) {
  const [s, setS] = useState(store.get());
  const [restoring, setRestoring] = useState<string | null>(null);
  useEffect(() => store.subscribe(setS), []);
  return (
    <Popup visible={visible} title="Settings" onClose={onClose} closeButton>
      <Text style={styles.section}>SOUND</Text>
      <Toggle label="Sound effects" value={s.sound !== false} onChange={(v) => store.set({ sound: v })} />
      <Toggle label="Music" note="Soft lo-fi loop, off by default" value={s.music === true} onChange={(v) => store.set({ music: v })} />
      <Toggle label={Platform.OS === "ios" ? "Haptics" : "Vibration"} value={s.haptics !== false} onChange={(v) => store.set({ haptics: v })} />
      <View style={styles.rule} />
      <Text style={styles.section}>CONTROLS</Text>
      <Segmented
        label="Hold to flag"
        note="How long to press a tile before it flags"
        value={s.holdMs ?? 400}
        options={[{ value: 250, label: "Quick" }, { value: 400, label: "Normal" }, { value: 600, label: "Slow" }, { value: 800, label: "Long" }]}
        onChange={(v) => store.set({ holdMs: v })}
      />
      <Toggle label="Left-handed" note="Tools move to the left side" value={!!s.leftHanded} onChange={(v) => store.set({ leftHanded: v })} />
      <View style={styles.rule} />
      <Text style={styles.section}>ACCESSIBILITY</Text>
      <Toggle label="Big tiles" note="Larger tiles on free-play boards" value={!!s.bigCells} onChange={(v) => store.set({ bigCells: v })} />
      <Toggle label="Colour-blind shapes" note="A shape mark under every number" value={!!s.colorblind} onChange={(v) => store.set({ colorblind: v })} />
      <View style={styles.rule} />
      <Text style={styles.section}>PURCHASES</Text>
      {s.adsRemoved ? (
        <Text style={styles.owned}>Ads removed — thank you!</Text>
      ) : Platform.OS !== "ios" || iap.items().some((i) => i.sku === "remove_ads") ? (
        // iOS: only offered once StoreKit returned the product.
        <GameButton size="sm" variant="accent" label="Remove Ads" onPress={() => iap.purchase("remove_ads").catch(() => {})} />
      ) : null}
      <GameButton
        style={{ marginTop: 10 }}
        size="sm"
        variant="light"
        label="Restore purchases"
        onPress={async () => {
          setRestoring("Checking…");
          await iap.restore(true).catch(() => {});
          setRestoring(store.get().adsRemoved ? "Purchases restored" : "No purchases found on this account");
        }}
      />
      {restoring ? <Text style={styles.small}>{restoring}</Text> : null}
      {privacyUrl ? (
        <Text style={styles.link} onPress={() => Linking.openURL(privacyUrl)}>Privacy policy</Text>
      ) : null}
      <GameButton style={{ marginTop: 14 }} label="Done" onPress={onClose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.body, fontSize: 12, letterSpacing: 1.6, color: palette.inkSoft, marginTop: 4 },
  rule: { height: 1.5, backgroundColor: "rgba(160,120,70,0.18)", marginVertical: 10 },
  owned: { fontFamily: fonts.display, fontSize: 16, color: palette.sageDark, textAlign: "center", paddingVertical: 8 },
  small: { fontFamily: fonts.bodyRegular, fontSize: 13, color: palette.inkSoft, textAlign: "center", marginTop: 6 },
  link: { fontFamily: fonts.bodyRegular, color: palette.inkSoft, textAlign: "center", marginTop: 12, textDecorationLine: "underline" },
});
