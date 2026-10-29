import { useEffect } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Panel } from "./Panel";
import { Leaf } from "./Art";
import { IconButton } from "./GameButton";
import { palette, springs, type } from "./theme";
import { play } from "../audio/sfx";

/**
 * Modal paper card that springs in over a warm dim. A leaf seal sits on the top edge; long content
 * scrolls inside the card so buttons are never pushed off a small phone.
 */
export function Popup({ visible, title, onClose, children, closeButton, overlay }: {
  visible: boolean; title?: string; onClose?: () => void; children: React.ReactNode; closeButton?: boolean;
  /** Full-screen layer drawn above the card inside the modal (celebration FX). */
  overlay?: React.ReactNode;
}) {
  // A Modal is its own native window: the app's root SafeAreaProvider doesn't measure it (insets read 0),
  // so the card reads its insets from a provider mounted inside the modal.
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>
        <PopupBody visible={visible} title={title} onClose={onClose} closeButton={closeButton} overlay={overlay}>
          {children}
        </PopupBody>
      </SafeAreaProvider>
    </Modal>
  );
}

function PopupBody({ visible, title, onClose, children, closeButton, overlay }: {
  visible: boolean; title?: string; onClose?: () => void; children: React.ReactNode; closeButton?: boolean; overlay?: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Keep the card (and its buttons) clear of the status bar / Dynamic Island and the gesture pill / home
  // indicator on every phone; the dim still covers the whole screen.
  const safePad = { paddingTop: Math.max(20, insets.top + 8), paddingBottom: Math.max(24, insets.bottom + 8) };
  const maxH = Math.min(height * 0.78, height - insets.top - insets.bottom - 150);
  const s = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      play("whoosh", 0.5);
      s.value = 0;
      s.value = withSpring(1, springs.pop);
    }
  }, [visible, s]);
  const card = useAnimatedStyle(() => ({ transform: [{ scale: 0.8 + 0.2 * s.value }, { translateY: (1 - s.value) * 30 }], opacity: Math.min(1, s.value * 1.5) }));
  const dim = useAnimatedStyle(() => ({ opacity: withTiming(visible ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) }) }));
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={[styles.center, safePad]} pointerEvents="box-none">
        <Animated.View style={[styles.cardWrap, card]}>
          <Panel pad={20}>
            <ScrollView style={{ maxHeight: maxH }} contentContainerStyle={{ paddingTop: 10 }} bounces={false} showsVerticalScrollIndicator={false}>
              {title ? <Text style={[type.title, styles.title]}>{title}</Text> : null}
              {children}
            </ScrollView>
          </Panel>
          <View style={styles.seal} pointerEvents="none">
            <View style={styles.sealDisc}>
              <Leaf size={26} />
            </View>
          </View>
          {closeButton && onClose ? (
            <View style={styles.close}>
              <IconButton icon="close" size={42} onPress={onClose} />
            </View>
          ) : null}
        </Animated.View>
      </View>
      {overlay}
    </>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: "rgba(58,38,18,0.5)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  cardWrap: { width: "100%", maxWidth: 420, paddingTop: 18 },
  title: { color: palette.brown, textAlign: "center", marginBottom: 12, marginTop: 4 },
  seal: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  sealDisc: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFF8EC", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#E2CBA4" },
  close: { position: "absolute", top: 4, right: -6 },
});
