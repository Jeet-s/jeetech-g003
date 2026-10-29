import { useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType, type ViewStyle, type StyleProp } from "react-native";
import { art, type ArtId } from "../art";

/**
 * Art helpers: every panel, plate and tray in the game is the generated art (src/art.ts), scaled
 * with a 9-slice so corners and rims keep their shape at any size.
 */
export const ART_SIZE: Partial<Record<ArtId, [number, number]>> = {
  board_tray_paperwood: [511, 512],
  hud_panel_parchment: [512, 278],
  button_primary_plate: [512, 217],
  button_secondary_plate: [512, 263],
  tile_mine_seedpod: [512, 274],
  tile_flag_fabric: [414, 512],
  icon_reward_leaf: [482, 512],
  hero_key_art_cozy_field: [445, 512],
  logo: [900, 455],
};

/** 9-slice of an art image. inset = source px kept unscaled-ratio at each edge; k = dest px per source px. */
export function NineSliceArt({ id, inset, k, w, h }: { id: ArtId; inset: [number, number, number, number]; k: number; w: number; h: number }) {
  const [sw, sh] = ART_SIZE[id] ?? [512, 512];
  const [l, t, r, b] = inset;
  const kk = Math.min(k, w / (l + r || 1), h / (t + b || 1));
  const cx = [0, Math.round(l * kk), Math.round(w - r * kk), w];
  const cy = [0, Math.round(t * kk), Math.round(h - b * kk), h];
  const sx = [0, l, sw - r, sw];
  const sy = [0, t, sh - b, sh];
  const out: React.ReactNode[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const dw = cx[i + 1] - cx[i];
      const dh = cy[j + 1] - cy[j];
      const srcW = sx[i + 1] - sx[i];
      const srcH = sy[j + 1] - sy[j];
      if (dw <= 0 || dh <= 0 || srcW <= 0 || srcH <= 0) continue;
      const scX = dw / srcW;
      const scY = dh / srcH;
      // +1px overlap hides hairline seams between slices.
      out.push(
        <View key={`${i}${j}`} style={{ position: "absolute", left: cx[i], top: cy[j], width: dw + (i < 2 ? 1 : 0), height: dh + (j < 2 ? 1 : 0), overflow: "hidden" }}>
          <Image source={art[id]} resizeMode="stretch" style={{ position: "absolute", left: -sx[i] * scX, top: -sy[j] * scY, width: sw * scX, height: sh * scY }} />
        </View>,
      );
    }
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>{out}</View>;
}

/** A view whose background is a 9-sliced art panel; measures itself. */
export function ArtPanel({ id = "hud_panel_parchment", inset = [70, 70, 70, 70], k = 0.42, style, children, onLayout }: {
  id?: ArtId; inset?: [number, number, number, number]; k?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
  onLayout?: (w: number, h: number) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={style}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: Math.round(width), h: Math.round(height) });
        onLayout?.(width, height);
      }}
    >
      {size.w > 0 ? <NineSliceArt id={id} inset={inset} k={k} w={size.w} h={size.h} /> : null}
      {children}
    </View>
  );
}

/** A rectangular crop of an art sheet, drawn `width` wide. */
export function Sprite({ id, crop, width, style }: { id: ArtId; crop?: [number, number, number, number]; width: number; style?: StyleProp<ViewStyle> }) {
  const [sw, sh] = ART_SIZE[id] ?? [512, 512];
  const [x, y, cw, ch] = crop ?? [0, 0, sw, sh];
  const s = width / cw;
  return (
    <View pointerEvents="none" style={[{ width, height: ch * s, overflow: "hidden" }, style]}>
      <Image source={art[id] as ImageSourcePropType} style={{ position: "absolute", left: -x * s, top: -y * s, width: sw * s, height: sh * s }} />
    </View>
  );
}

/** The seed pod ("mine") and its burst variant live side by side on one sheet. */
export const POD_CROP: [number, number, number, number] = [0, 0, 178, 257];
export const BURST_CROP: [number, number, number, number] = [278, 0, 234, 274];

/** Leaf currency icon. */
export function Leaf({ size = 28, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return <Sprite id="icon_reward_leaf" width={size} style={style} />;
}
