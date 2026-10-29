import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Popup } from "./Popup";
import { Stars } from "./Stars";
import { GameButton } from "./GameButton";
import { AnimatedNumber } from "./AnimatedNumber";
import { Leaf } from "./Art";
import { Icon } from "./Icon";
import { LeafConfetti } from "../fx/LeafConfetti";
import { fonts, palette } from "./theme";
import { play, haptic } from "../audio/sfx";

/** Field cleared: stars pop in with chimes, leaf confetti drifts, leaves count up, time + best. */
export function WinPopup({ visible, stars, coins, onNext, onReplay, onMap, title = "Field Cleared!", time, best, note, nextLabel = "Next Level" }: {
  visible: boolean; stars?: number; coins: number; onNext: () => void; onReplay?: () => void; onMap?: () => void; title?: string;
  time?: string; best?: string; note?: string; nextLabel?: string;
}) {
  const [burst, setBurst] = useState(0);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setReveal(false);
    play("success");
    haptic("success");
    const a = setTimeout(() => setBurst((b) => b + 1), 150);
    const c = setTimeout(() => {
      setReveal(true);
      play("coin");
    }, stars ? 1400 : 500);
    return () => { clearTimeout(a); clearTimeout(c); };
  }, [visible, coins, stars]);
  return (
    <Popup visible={visible} title={title} overlay={<LeafConfetti trigger={burst} />}>
        {stars ? <Stars count={stars} animate={visible} size={50} /> : null}
        {time ? (
          <View style={styles.timeRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>TIME</Text>
              <Text style={styles.statValue}>{time}</Text>
            </View>
            {best ? (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>BEST</Text>
                <Text style={styles.statValue}>{best}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.reward}>
          <Leaf size={32} />
          {/* No number until it counts up from 0 (never a "+0"); the hidden final value keeps the slot's size. */}
          <View style={[styles.rewardNum, !reveal && styles.hidden]}>
            <Text style={styles.plus}>+</Text>
            {reveal ? <AnimatedNumber from={0} value={coins} style={styles.coinText} /> : <Text style={styles.coinText}>{coins}</Text>}
          </View>
          <Text style={styles.leaves}>leaves</Text>
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <GameButton label={nextLabel} variant="accent" size="lg" onPress={onNext} sound="whoosh" />
        <View style={styles.row}>
          {onReplay ? <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Replay" icon={<Icon name="restart" size={18} />} onPress={onReplay} /> : null}
          {onMap ? <GameButton style={{ flex: 1 }} size="sm" variant="light" label="Map" icon={<Icon name="map" size={18} />} onPress={onMap} /> : null}
        </View>
    </Popup>
  );
}

export interface FailAction { label: string; onPress: () => void; sub?: React.ReactNode; variant?: "primary" | "accent" | "light" | "secondary" }

/**
 * Pod uncovered: calm copy, then the options in order of kindness — the free Undo first, an optional
 * revive (rewarded ad or leaves; never auto-played), a fresh try, the map.
 */
export function FailPopup({ visible, title = "A seed pod!", message = "Every field is solvable without guessing — look again.", actions, onMap }: {
  visible: boolean; title?: string; message?: string; actions: FailAction[]; onMap?: () => void;
}) {
  useEffect(() => {
    if (visible) { play("fail", 0.6); haptic("warning"); }
  }, [visible]);
  return (
    <Popup visible={visible} title={title}>
      <Text style={styles.msg}>{message}</Text>
      <View style={{ gap: 10 }}>
        {actions.map((a, i) => (
          <GameButton key={a.label} label={a.label} sub={a.sub} variant={a.variant ?? (i === 0 ? "primary" : "light")} size={i === 0 ? "lg" : "md"} onPress={a.onPress} />
        ))}
        {onMap ? <GameButton size="sm" variant="light" label="Back to map" icon={<Icon name="map" size={18} />} onPress={onMap} /> : null}
      </View>
    </Popup>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  stat: { flex: 1, alignItems: "center", backgroundColor: "rgba(214,188,148,0.35)", borderRadius: 14, paddingVertical: 6 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1.4, color: palette.inkSoft },
  statValue: { fontFamily: fonts.display, fontSize: 24, color: palette.brown },
  reward: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginVertical: 14, backgroundColor: "rgba(140,164,113,0.18)", borderRadius: 18, paddingVertical: 10 },
  rewardNum: { flexDirection: "row", alignItems: "center", gap: 6 },
  hidden: { opacity: 0 },
  plus: { fontFamily: fonts.display, fontSize: 26, color: palette.sageDark },
  coinText: { fontFamily: fonts.display, fontSize: 30, color: palette.sageDark },
  leaves: { fontFamily: fonts.body, fontSize: 15, color: palette.sageDark, marginTop: 6 },
  note: { fontFamily: fonts.bodyRegular, fontSize: 14, color: palette.inkSoft, textAlign: "center", marginTop: -4, marginBottom: 12 },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  msg: { fontFamily: fonts.body, fontSize: 16, color: palette.inkSoft, textAlign: "center", marginBottom: 16, lineHeight: 22 },
});
