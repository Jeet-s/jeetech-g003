import { useEffect, useRef, useState } from "react";
import { Text, type TextStyle } from "react-native";

/** Counts smoothly to `value` (coins, score) — rewards should never just "snap". */
export function AnimatedNumber({ value, style, duration = 600, from: start0 }: { value: number; style?: TextStyle; duration?: number; from?: number }) {
  const [shown, setShown] = useState(start0 ?? value);
  const from = useRef(start0 ?? value);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style}>{shown.toLocaleString()}</Text>;
}
