import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { fonts, palette, springs } from "./theme";
import { feedback } from "../audio/sfx";

/** Settings row: label (+ optional note) and a springy pill switch. */
export function Toggle({ label, note, value, onChange }: { label: string; note?: string; value: boolean; onChange: (v: boolean) => void }) {
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 26 : 0, { damping: 11, stiffness: 260, mass: 0.6 }) }] }));
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        feedback("tap", "select");
        onChange(!value);
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? palette.sage : "#DCCBB0" }]}>
        <Animated.View style={[styles.knob, knob]} />
      </View>
    </Pressable>
  );
}

/** Segmented choice (e.g. flag hold time). */
export function Segmented<T extends string | number>({ label, note, options, value, onChange }: {
  label: string; note?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      <Text style={styles.label}>{label}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={styles.segRow}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => {
                feedback("tap", "select");
                onChange(o.value);
              }}
              style={[styles.segItem, on && styles.segOn]}
            >
              <Text style={[styles.segText, on && { color: "#FFFBF0" }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, minHeight: 50 },
  label: { fontFamily: fonts.body, fontSize: 17, color: palette.ink },
  note: { fontFamily: fonts.bodyRegular, fontSize: 12.5, color: palette.inkSoft, marginTop: 1 },
  track: { width: 58, height: 32, borderRadius: 16, padding: 3, borderWidth: 1, borderColor: "rgba(110,80,40,0.2)" },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFBF3", elevation: 3, shadowColor: "#5A3B1C", shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  seg: { paddingVertical: 9 },
  segRow: { flexDirection: "row", marginTop: 8, backgroundColor: "#EAD9BC", borderRadius: 14, padding: 3, gap: 3 },
  segItem: { flex: 1, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: palette.sage },
  segText: { fontFamily: fonts.display, fontSize: 15, color: palette.brown },
});
