/**
 * Design tokens. Every screen uses these — never raw colours, sizes or system
 * fonts. The builder re-skins a game by editing `palette` (from the art bible),
 * not by hard-coding styles in components.
 */
export const palette = {
  // Brand (art bible tokens — docs/ART_DIRECTION.md)
  primary: "#4CAF50",
  primaryDark: "#2E7D32",
  secondary: "#F6EBDD",
  secondaryDark: "#BFA88F",
  accent: "#FF6B6B",
  accentDark: "#C54545",
  danger: "#E4664F",
  dangerDark: "#B2442F",
  // Surfaces
  bgTop: "#F7EDE0",
  bgBottom: "#E6D2B4",
  surface: "#FBF4E8",
  surfaceAlt: "#F1E3CB",
  surfaceDark: "#5B4632",
  ink: "#2A2A24",
  inkSoft: "#7A6650",
  brown: "#6B4A2B",
  onPrimary: "#FFFFFF",
  // Materials
  sage: "#8CA471",
  sageDark: "#5F7A4B",
  gold: "#F4BE45",
  goldDark: "#C98A1E",
  wood: "#B9824A",
  woodDark: "#7E5230",
  groove: "#CDAF82",
  // Game feedback
  star: "#F5B83D",
  coin: "#8DB36B",
  success: "#5E9E4A",
};

export const fonts = {
  display: "Fredoka_700Bold",
  displayMedium: "Fredoka_600SemiBold",
  body: "Nunito_700Bold",
  bodyRegular: "Nunito_600SemiBold",
};

export const radius = { sm: 12, md: 18, lg: 26, xl: 36, pill: 999 };
export const space = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 };

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 44, letterSpacing: 0.5 },
  label: { fontFamily: fonts.body, fontSize: 12, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, fontSize: 30 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 22 },
  body: { fontFamily: fonts.body, fontSize: 16 },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 13 },
  button: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 0.6 },
};

/** Soft drop shadow used on cards and buttons (iOS + Android). */
export const shadow = {
  shadowColor: "#5A3B1C",
  shadowOpacity: 0.22,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

/** Spring presets — use these so every animation in the game feels consistent. */
export const springs = {
  press: { damping: 14, stiffness: 320, mass: 0.6 },
  pop: { damping: 9, stiffness: 220, mass: 0.7 },
  gentle: { damping: 18, stiffness: 140, mass: 1 },
};

/** Revealed-number ink: colour-blind-safe set with luminance steps (art bible). */
export const numberInk = ["", "#1E88E5", "#2E7D32", "#C0392B", "#6A5ACD", "#8E44AD", "#00897B", "#5D4037", "#607D8B"];
