import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { GameButton, Icon, Leaf, Popup, Sprite, fonts, palette, feedback } from "../ui";
import { iap, type ShopItem } from "../modules/iap";
import { ads } from "../modules/ads";
import { store } from "../modules/store";
import { art } from "../art";
import monetization from "../../monetization.json";

/** Field themes: cosmetic backgrounds for Home and free-play boards, bought with leaves (fixed prices). */
export const THEMES: { id: "paper" | "garden" | "night"; name: string; price: number }[] = [
  { id: "paper", name: "Cozy Paper", price: 0 },
  { id: "garden", name: "Garden Table", price: 200 },
  { id: "night", name: "Night Sky", price: 350 },
];
const THEME_BG = { paper: art.bg_parchment_cozy, garden: art.bg_garden_wood, night: art.bg_night_sky };

const LABEL: Record<string, { title: string; desc: string }> = {
  remove_ads: { title: "Remove Ads", desc: "One-time. No banners or breaks; hints & revives become free." },
  coins_small: { title: "Handful of Leaves", desc: "" },
  coins_large: { title: "Basket of Leaves", desc: "" },
};

/** Shop: Remove Ads, leaf packs (IAP), free leaves (rewarded ad), field themes, restore purchases. */
export function ShopScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [state, setState] = useState(store.get());
  const [items, setItems] = useState<ShopItem[]>(iap.items());
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => store.subscribe(setState), []);
  useEffect(() => { if (visible) { setItems(iap.items()); setMsg(null); } }, [visible]);
  // iOS: only StoreKit's products, at StoreKit's prices — never a fallback price or a dead buy button.
  const ios = Platform.OS === "ios";
  const sold = (sku: string) => !ios || items.some((i) => i.sku === sku);
  const price = (sku: string) => items.find((i) => i.sku === sku)?.price ?? `$${monetization.iap.find((p) => p.sku === sku)?.priceUsd ?? ""}`;
  const buy = (sku: string) => {
    if (!items.length) { setMsg("The store is offline right now — try again when you're connected."); return; }
    iap.purchase(sku).catch(() => {});
  };
  const owned = state.ownedThemes ?? ["paper"];
  return (
    <Popup visible={visible} title="Shop" onClose={onClose} closeButton>
      <View style={styles.balance}>
        <Leaf size={28} />
        <Text style={styles.balanceText}>{state.coins.toLocaleString()} leaves</Text>
      </View>
      {!state.adsRemoved ? (sold("remove_ads") ? (
        <View style={[styles.row, styles.feature]}>
          <View style={styles.iconBox}><Icon name="ad" size={30} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{LABEL.remove_ads.title}</Text>
            <Text style={styles.desc}>{LABEL.remove_ads.desc}</Text>
          </View>
          <GameButton size="sm" variant="accent" label={price("remove_ads")} onPress={() => buy("remove_ads")} />
        </View>
      ) : null) : (
        <Text style={styles.ownedNote}>Ads removed — hints and revives are free.</Text>
      )}
      {monetization.iap.filter((p) => p.sku !== "remove_ads" && sold(p.sku)).map((p) => (
        <View key={p.sku} style={styles.row}>
          <View style={styles.iconBox}>
            <Leaf size={p.sku === "coins_large" ? 34 : 26} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{LABEL[p.sku]?.title ?? p.title}</Text>
            <Text style={styles.desc}>{(p.coins ?? 0).toLocaleString()} leaves</Text>
          </View>
          <GameButton size="sm" variant="primary" label={price(p.sku)} onPress={() => buy(p.sku)} />
        </View>
      ))}
      {ads.rewardedAvailable() && !state.adsRemoved ? (
        <View style={styles.row}>
          <View style={styles.iconBox}><Icon name="play" size={24} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Free leaves</Text>
            <Text style={styles.desc}>Watch a short ad · +30 leaves</Text>
          </View>
          <GameButton size="sm" variant="light" label="Watch" onPress={() => ads.showRewarded(() => store.set({ coins: store.get().coins + 30 }))} />
        </View>
      ) : null}

      <Text style={styles.section}>FIELD THEMES</Text>
      <View style={styles.themes}>
        {THEMES.map((t) => {
          const has = owned.includes(t.id);
          const on = (state.theme ?? "paper") === t.id;
          return (
            <View key={t.id} style={[styles.theme, on && styles.themeOn]}>
              <Image source={THEME_BG[t.id]} style={styles.themeImg} resizeMode="cover" />
              <View style={styles.themeTiles}>
                <Image source={art.tile_hidden_card} style={styles.mini} resizeMode="stretch" />
                <Image source={art.tile_revealed_empty} style={styles.mini} resizeMode="stretch" />
                <View style={styles.mini}>
                  <Image source={art.tile_hidden_card} style={styles.miniImg} resizeMode="stretch" />
                  <View style={{ position: "absolute", left: 5, top: 3 }}><Sprite id="tile_flag_fabric" width={12} /></View>
                </View>
              </View>
              <Text style={styles.themeName} numberOfLines={1}>{t.name}</Text>
              <GameButton
                size="sm"
                variant={on ? "primary" : has ? "light" : "light"}
                label={on ? "In use" : has ? "Use" : `${t.price}`}
                icon={!has ? <Leaf size={16} /> : undefined}
                disabled={!has && state.coins < t.price}
                onPress={() => {
                  if (on) return;
                  if (!has) {
                    store.set({ coins: store.get().coins - t.price, ownedThemes: [...owned, t.id], theme: t.id });
                    feedback("unlock", "success");
                  } else store.set({ theme: t.id });
                }}
                style={{ alignSelf: "stretch" }}
              />
            </View>
          );
        })}
      </View>
      <Text style={styles.small}>Themes dress Home and free-play boards; chapters keep their own scenery.</Text>
      {ios && !items.length ? <Text style={styles.small}>Purchases are unavailable right now — check your connection and reopen the shop.</Text> : null}
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <GameButton style={{ marginTop: 10 }} size="sm" variant="light" label="Restore purchases" onPress={() => iap.restore(true).then(() => setMsg(store.get().adsRemoved ? "Purchases restored." : "No purchases to restore.")).catch(() => {})} />
      <GameButton style={{ marginTop: 10 }} label="Close" onPress={onClose} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  balanceText: { fontFamily: fonts.display, fontSize: 22, color: palette.sageDark },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(214,188,148,0.3)", borderRadius: 16, padding: 10, marginBottom: 10 },
  feature: { backgroundColor: "rgba(244,190,69,0.22)", borderWidth: 1.5, borderColor: "rgba(201,138,30,0.35)" },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF8EA", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 16.5, color: palette.brown },
  desc: { fontFamily: fonts.bodyRegular, fontSize: 12.5, color: palette.inkSoft },
  ownedNote: { fontFamily: fonts.display, fontSize: 15, color: palette.sageDark, textAlign: "center", marginBottom: 10 },
  section: { fontFamily: fonts.body, fontSize: 12, letterSpacing: 1.6, color: palette.inkSoft, marginTop: 6, marginBottom: 8 },
  themes: { flexDirection: "row", gap: 8 },
  theme: { flex: 1, borderRadius: 14, overflow: "hidden", padding: 6, alignItems: "center", gap: 4, borderWidth: 2, borderColor: "transparent", backgroundColor: "rgba(214,188,148,0.3)" },
  themeOn: { borderColor: palette.sage },
  themeImg: { position: "absolute", left: 0, top: 0, width: "100%", height: 70 },
  themeTiles: { flexDirection: "row", gap: 2, height: 64, alignItems: "center" },
  mini: { width: 24, height: 24, borderRadius: 5, overflow: "hidden" },
  miniImg: { position: "absolute", left: 0, top: 0, width: 24, height: 24 },
  themeName: { fontFamily: fonts.body, fontSize: 12, color: palette.brown },
  small: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, textAlign: "center", marginTop: 8 },
  msg: { fontFamily: fonts.body, fontSize: 13, color: palette.dangerDark, textAlign: "center", marginTop: 8 },
});
