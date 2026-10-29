import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, Popup, Toggle, StarGlyph, fonts, palette, feedback } from "../ui";
import { DAILY_TIERS, MODES } from "../game/engine";
import { dailySession, dayKey, fmtTime, freeSession, liveDailyStreak, type Session } from "../game/session";
import { store } from "../modules/store";
import { analytics } from "../modules/analytics";

/** Free play: today's three daily fields (shared seed, streak) and the classic no-guess modes. */
export function FreePlayScreen({ visible, onClose, onStart }: { visible: boolean; onClose: () => void; onStart: (s: Session) => void }) {
  const [s, setS] = useState(store.get());
  const [cozy, setCozy] = useState(false);
  useEffect(() => store.subscribe(setS), []);
  const done = (s.daily ?? {})[dayKey()] ?? [];
  const streak = liveDailyStreak();
  return (
    <Popup visible={visible} title="Daily & Free Play" onClose={onClose} closeButton>
      <View style={styles.streak}>
        <Icon name="calendar" size={22} />
        <Text style={styles.streakText}>{streak > 0 ? `${streak}-day streak` : "Start a daily streak today"}</Text>
      </View>
      <View style={styles.dailies}>
        {DAILY_TIERS.map((m, t) => {
          const cleared = done.includes(t);
          return (
            <Pressable
              key={m.id}
              style={({ pressed }) => [styles.daily, cleared && styles.dailyDone, pressed && { transform: [{ scale: 0.95 }] }]}
              onPress={() => {
                feedback("pop", "medium");
                analytics_daily(t);
                onStart(dailySession(t as 0 | 1 | 2));
              }}
            >
              <Text style={styles.dailyName}>{m.name}</Text>
              <Text style={styles.dailySize}>{m.w}×{m.h} · {m.pods}</Text>
              {cleared ? <Icon name="check" size={22} color={palette.sageDark} /> : <Text style={styles.dailyReward}>+25 leaves</Text>}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.section}>CLASSIC FIELDS · FIRST TAP ALWAYS SAFE</Text>
      {MODES.map((m) => {
        const st = s.modeStats?.[m.id];
        return (
          <Pressable
            key={m.id}
            style={({ pressed }) => [styles.mode, pressed && { transform: [{ scale: 0.97 }] }]}
            onPress={() => {
              feedback("pop", "medium");
              onStart(freeSession(m.id, cozy));
            }}
          >
            <View style={styles.modeIcon}><Icon name="grid" size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeName}>{m.name}</Text>
              <Text style={styles.modeSub}>{m.w}×{m.h} · {m.pods} pods{m.w * m.h > 200 ? " · scrolls" : ""}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {st?.best !== undefined ? (
                <View style={styles.best}><StarGlyph size={14} /><Text style={styles.bestText}>{fmtTime(st.best)}</Text></View>
              ) : null}
              <Text style={styles.modeSub}>{st ? `${st.wins}/${st.plays} won${st.streak > 1 ? ` · ${st.streak} streak` : ""}` : "New"}</Text>
            </View>
          </Pressable>
        );
      })}
      <Toggle label="No-Fail Cozy" note="A pod costs a slip, never the board (unranked)" value={cozy} onChange={setCozy} />
    </Popup>
  );
}

function analytics_daily(tier: number) {
  analytics.track("daily_started", { tier });
}

const styles = StyleSheet.create({
  streak: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  streakText: { fontFamily: fonts.display, fontSize: 16, color: palette.brown },
  dailies: { flexDirection: "row", gap: 8 },
  daily: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 12, borderRadius: 16, backgroundColor: "rgba(244,190,69,0.25)", borderWidth: 1.5, borderColor: "rgba(201,138,30,0.35)", minHeight: 92, justifyContent: "center" },
  dailyDone: { backgroundColor: "rgba(140,164,113,0.25)", borderColor: "rgba(95,122,75,0.4)" },
  dailyName: { fontFamily: fonts.display, fontSize: 17, color: palette.brown },
  dailySize: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  dailyReward: { fontFamily: fonts.body, fontSize: 12, color: palette.sageDark },
  section: { fontFamily: fonts.body, fontSize: 11.5, letterSpacing: 1.3, color: palette.inkSoft, marginTop: 14, marginBottom: 8 },
  mode: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(214,188,148,0.3)", borderRadius: 14, padding: 10, marginBottom: 8, minHeight: 58 },
  modeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFF8EA", alignItems: "center", justifyContent: "center" },
  modeName: { fontFamily: fonts.display, fontSize: 16.5, color: palette.brown },
  modeSub: { fontFamily: fonts.bodyRegular, fontSize: 12, color: palette.inkSoft },
  best: { flexDirection: "row", alignItems: "center", gap: 3 },
  bestText: { fontFamily: fonts.display, fontSize: 14, color: palette.brown },
});
