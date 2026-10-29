import { StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";
import { ArtPanel } from "./Art";
import { shadow } from "./theme";

/** Parchment card (the hud_panel_parchment art, 9-sliced) — popups, HUD groups, info cards. */
export function Panel({ children, style, pad = 22 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number; dark?: boolean }) {
  return (
    <View style={[styles.wrap, shadow, style]}>
      <ArtPanel inset={[60, 60, 60, 60]} k={0.4} style={{ padding: pad }}>
        {children}
      </ArtPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 24, backgroundColor: "transparent" },
});
