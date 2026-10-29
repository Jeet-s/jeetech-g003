import { StyleSheet, View } from "react-native";
import { AnimatedNumber } from "./AnimatedNumber";
import { Leaf } from "./Art";
import { StarGlyph } from "./Icon";
import { fonts, palette } from "./theme";

/** HUD pill: art icon (leaf / star / custom) + animated count. */
export function CurrencyPill({ icon, value }: { icon: "leaf" | "star" | React.ReactNode; value: number; color?: string }) {
  return (
    <View style={styles.pill}>
      <View style={styles.icon}>{icon === "leaf" ? <Leaf size={26} /> : icon === "star" ? <StarGlyph size={28} /> : icon}</View>
      <AnimatedNumber value={value} style={styles.value} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,249,238,0.92)", borderRadius: 999, paddingRight: 16, paddingLeft: 4, height: 40, borderWidth: 1.5, borderColor: "rgba(160,120,70,0.25)", shadowColor: "#5A3B1C", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  icon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", marginRight: 6 },
  value: { fontFamily: fonts.display, fontSize: 19, color: palette.brown, minWidth: 26 },
});
