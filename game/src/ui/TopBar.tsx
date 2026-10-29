import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "./GameButton";
import type { IconName } from "./Icon";
import { fonts, palette } from "./theme";

/** Screen header: back token, a paper title tab, settings token. Sits under the status bar. */
export function TopBar({ title, subtitle, onBack, onSettings, right, backIcon = "back" }: {
  title?: string; subtitle?: string; onBack?: () => void; onSettings?: () => void; right?: React.ReactNode; backIcon?: IconName;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <View style={styles.side}>{onBack ? <IconButton icon={backIcon} size={48} onPress={onBack} /> : null}</View>
      <View style={styles.tab}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        {subtitle ? <Text style={styles.sub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {right ?? (onSettings ? <IconButton icon="settings" size={48} onPress={onSettings} /> : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 6, gap: 10 },
  side: { width: 56 },
  tab: { flex: 1, alignItems: "center", backgroundColor: "rgba(255,249,238,0.9)", borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1.5, borderColor: "rgba(160,120,70,0.22)" },
  title: { fontFamily: fonts.display, fontSize: 21, color: palette.brown },
  sub: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft, marginTop: -1 },
});
