import { Platform } from "react-native";
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  syncIOS,
  type Purchase,
} from "./expo-iap-ios";
import monetization from "../../monetization.json";
import { store } from "./store";
import { analytics } from "./analytics";

/**
 * Google Play Billing / StoreKit via expo-iap. Products are defined in monetization.json
 * and created in Play Console and App Store Connect by the factory's publisher (same SKUs).
 * On iOS only products StoreKit returned (with their store prices) may be offered.
 */
type Sku = { sku: string; consumable: boolean; coins?: number };
const catalog: Sku[] = monetization.iap;
const bySku = new Map(catalog.map((p) => [p.sku, p]));

export interface ShopItem {
  sku: string;
  title: string;
  price: string;
}

let connected = false;
let items: ShopItem[] = [];

function grant(p: Purchase): void {
  const def = bySku.get(p.productId);
  if (!def) return;
  if (p.productId === "remove_ads") store.set({ adsRemoved: true });
  if (def.coins) store.set({ coins: store.get().coins + def.coins });
  analytics.track("iap_purchase", { sku: p.productId });
}

export const iap = {
  async init(): Promise<void> {
    try {
      connected = await initConnection();
      if (!connected) return;
      purchaseUpdatedListener(async (p) => {
        grant(p);
        const def = bySku.get(p.productId);
        await finishTransaction({ purchase: p, isConsumable: !!def?.consumable }).catch(() => {});
      });
      purchaseErrorListener((e) => {
        if (__DEV__) console.warn("[iap] purchase error", e);
      });
      const products = (await fetchProducts({ skus: catalog.map((p) => p.sku), type: "in-app" })) ?? [];
      items = products.map((p) => ({
        sku: p.id,
        title: p.title,
        price: p.displayPrice,
      }));
      await iap.restore();
    } catch (e) {
      if (__DEV__) console.warn("[iap] init failed", e);
    }
  },

  items(): ShopItem[] {
    return items;
  },

  async purchase(sku: string): Promise<void> {
    if (!connected) return;
    if (Platform.OS === "ios" && !items.some((i) => i.sku === sku)) return;
    await requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: "in-app" });
  },

  /** Re-grant non-consumables (remove_ads) on reinstall / new device. Pass userInitiated from a
   *  "Restore purchases" button: on iOS that first syncs with the App Store (may ask to sign in). */
  async restore(userInitiated = false): Promise<void> {
    if (!connected) return;
    if (userInitiated && Platform.OS === "ios") await syncIOS().catch(() => {});
    const owned = await getAvailablePurchases();
    for (const p of owned ?? []) {
      if (p.productId === "remove_ads") store.set({ adsRemoved: true });
    }
  },
};
