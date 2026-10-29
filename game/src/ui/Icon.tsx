import { useMemo, memo } from "react";
import { Canvas, Group, Path, Skia, type SkPath } from "@shopify/react-native-skia";
import { palette } from "./theme";

/**
 * Engraved line icons for the ceramic token buttons (24-unit grid, drawn with Skia). Each icon is
 * stroked in ink with a 1px light "cut" below it so it reads as pressed into the clay.
 */
function gear(): string {
  const teeth = 8;
  const pts: string[] = [];
  for (let k = 0; k < teeth * 4; k++) {
    const a = (k / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
    const r = k % 4 === 0 || k % 4 === 1 ? 9.6 : 7.2;
    pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z M15 12 A3 3 0 1 1 9 12 A3 3 0 1 1 15 12 Z`;
}

function star(cx = 12, cy = 12, ro = 10, ri = 4.4): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? ri : ro;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

const PATHS = {
  undo: "M8.5 6.5 L4 11 L8.5 15.5 M4.6 11 H14.5 A5 5 0 0 1 14.5 21 H10",
  restart: "M19 12.5 A7 7 0 1 1 12 5.5 H15 M12.5 2.5 L15.5 5.5 L12.5 8.5",
  hint: "M9.2 17.5 H14.8 M10.2 20.5 H13.8 M12 3.5 A6 6 0 0 0 8.2 14 C8.9 14.7 9.2 15.4 9.2 16 H14.8 C14.8 15.4 15.1 14.7 15.8 14 A6 6 0 0 0 12 3.5 Z",
  pause: "M9 6 V18 M15 6 V18",
  map: "M12 21.5 C12 21.5 5.5 15.6 5.5 10 A6.5 6.5 0 0 1 18.5 10 C18.5 15.6 12 21.5 12 21.5 Z M14.4 10 A2.4 2.4 0 1 1 9.6 10 A2.4 2.4 0 1 1 14.4 10 Z",
  shop: "M4 9.5 L5.4 4.5 H18.6 L20 9.5 C20 11 18.9 12 17.5 12 C16.1 12 15 11 15 9.5 C15 11 13.6 12 12 12 C10.4 12 9 11 9 9.5 C9 11 7.9 12 6.5 12 C5.1 12 4 11 4 9.5 Z M5.5 12 V20 H18.5 V12 M10 20 V15.5 H14 V20",
  settings: gear(),
  back: "M14.5 5 L7.5 12 L14.5 19",
  home: "M4 11.5 L12 4.5 L20 11.5 M6.5 9.5 V20 H17.5 V9.5 M10 20 V14.5 H14 V20",
  close: "M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5",
  lock: "M7 11 H17 V20 H7 Z M9 11 V8 A3 3 0 0 1 15 8 V11",
  play: "M8 5 L19 12 L8 19 Z",
  check: "M5 12.5 L10 17.5 L19 7",
  grid: "M4.5 4.5 H10.5 V10.5 H4.5 Z M13.5 4.5 H19.5 V10.5 H13.5 Z M4.5 13.5 H10.5 V19.5 H4.5 Z M13.5 13.5 H19.5 V19.5 H13.5 Z",
  calendar: "M4.5 6.5 H19.5 V19.5 H4.5 Z M4.5 10.5 H19.5 M8.5 4 V8 M15.5 4 V8 M9 14.5 H10 M14 14.5 H15",
  star: star(),
  tap: "M10 13 V6.2 A1.6 1.6 0 0 1 13.2 6.2 V11.5 L17.6 12.6 A2 2 0 0 1 19.1 14.9 L18.2 19.5 A1.6 1.6 0 0 1 16.6 20.8 H11.6 L6.8 16 A1.4 1.4 0 0 1 8.8 14 Z",
  flag: "M7 21 V4 M7 4.5 C10 3 12.5 6.5 17.5 4.5 V12.5 C12.5 14.5 10 11 7 12.5",
  trophy: "M8 4.5 H16 V9 A4 4 0 0 1 8 9 Z M8 6 H5 C5 9 6.5 10 8.3 10.2 M16 6 H19 C19 9 17.5 10 15.7 10.2 M12 13 V17 M8.5 20 H15.5 L14.5 17 H9.5 Z",
  sound: "M4.5 9.5 H8 L12.5 5.5 V18.5 L8 14.5 H4.5 Z M15.5 9 A4 4 0 0 1 15.5 15 M18 6.5 A7.5 7.5 0 0 1 18 17.5",
  ad: "M4 6.5 H20 V17.5 H4 Z M10 9.5 L14.5 12 L10 14.5 Z",
} as const;
export type IconName = keyof typeof PATHS;
const FILLED: Partial<Record<IconName, boolean>> = { play: true, star: true };

const cache = new Map<string, SkPath | null>();
function pathOf(name: IconName): SkPath | null {
  if (!cache.has(name)) cache.set(name, Skia.Path.MakeFromSVGString(PATHS[name]));
  return cache.get(name) ?? null;
}

export const Icon = memo(function Icon({ name, size = 26, color = palette.brown, weight = 2.3, engraved = true }: {
  name: IconName; size?: number; color?: string; weight?: number; engraved?: boolean;
}) {
  const path = useMemo(() => pathOf(name), [name]);
  const s = size / 24;
  if (!path) return null;
  const filled = FILLED[name];
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      {engraved ? (
        <Group transform={[{ translateY: 1.1 }, { scale: s }]}>
          <Path path={path} style={filled ? "fill" : "stroke"} strokeWidth={weight} strokeCap="round" strokeJoin="round" color="rgba(255,255,255,0.65)" />
        </Group>
      ) : null}
      <Group transform={[{ scale: s }]}>
        <Path path={path} style={filled ? "fill" : "stroke"} strokeWidth={weight} strokeCap="round" strokeJoin="round" color={color} />
      </Group>
    </Canvas>
  );
});

/** Gold award star (filled, rimmed, glossy) — stars on the win card, map and HUD. */
export const StarGlyph = memo(function StarGlyph({ size = 28, on = true }: { size?: number; on?: boolean }) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(star(12, 12.6, 10.6, 5.2)), []);
  const gloss = useMemo(() => Skia.Path.MakeFromSVGString("M7.4 9.6 L10.4 9.2 L12 4.6 L12.9 7.6 Z"), []);
  if (!path) return null;
  const s = size / 24;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: s }]}>
        <Group transform={[{ translateY: 1.2 }]}>
          <Path path={path} color={on ? "#B9781A" : "rgba(120,92,60,0.35)"} />
        </Group>
        <Path path={path} color={on ? palette.gold : "#E3D3BA"} />
        <Path path={path} style="stroke" strokeWidth={1.3} strokeJoin="round" color={on ? "#C98A1E" : "#C9B597"} />
        {on && gloss ? <Path path={gloss} color="rgba(255,255,255,0.7)" /> : null}
      </Group>
    </Canvas>
  );
});

/** Three small stars in ONE canvas (level-map nodes: many of them on screen). */
export const StarRow = memo(function StarRow({ count, size = 15 }: { count: number; size?: number }) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(star(12, 12.6, 10.6, 5.2)), []);
  if (!path) return null;
  const s = size / 24;
  return (
    <Canvas style={{ width: size * 3, height: size }} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <Group key={i} transform={[{ translateX: i * size }, { scale: s }]}>
          <Path path={path} color={i < count ? palette.gold : "#E3D3BA"} />
          <Path path={path} style="stroke" strokeWidth={1.4} strokeJoin="round" color={i < count ? "#C98A1E" : "#C9B597"} />
        </Group>
      ))}
    </Canvas>
  );
});
