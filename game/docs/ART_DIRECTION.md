# Art direction — Minesweeper Offline: Cozy Fields

Target: .agf/art/target.png (vs big-studio games Royal Match +1.5, Monument Valley -2, Homescapes +2 → net +0.5 (need ≥ 0)). Every screen must look like it.

## Style
Premium cozy minimalism with tactile materials: a sunlit, top‑left key light (35°) kisses soft‑touch paper tiles resting in a shallow wooden tray; edges are rounded and chamfered with a 1–2 px highlight and tight ambient occlusion in seams to suggest hand‑cut card stock. Surfaces carry a whisper of paper grain and 1% film grain; shading is calm and even, with gentle falloff shadows that lift elements from a warm parchment backdrop. Numbers are subtly embossed ink, flags are stitched fabric with a faint sheen and tiny fiber texture, mines are abstract seed pods in matte ceramic with a satin rim light—nothing violent. The overall mood is restful, offline, and thoughtfully crafted; color is warm and low‑saturation with clear contrast, depth is layered in three tiers (background, tray, interactive pieces) for instant legibility, and micro‑animations feel springy and humane.

## Palette
#F6EBDD #E6D2B4 #BFA88F #4CAF50 #FF6B6B #1E88E5

UI kit tokens (src/ui/theme.ts): {"primary":"#4CAF50","primaryDark":"#2E7D32","secondary":"#F6EBDD","secondaryDark":"#BFA88F","accent":"#FF6B6B","accentDark":"#C54545","bgTop":"#F7EDE0","bgBottom":"#E6D2B4","ink":"#2A2A24"}

## Screen spec
- **background**: Warm parchment gradient from bgTop to bgBottom with a soft oval vignette and faint pressed‑leaf watermark in one lower corner; subtle parallax leaf‑shadow pass moves 1–2 px on scroll for life without distraction.
- **board**: A floating wooden/paper tray (12–16 px radius) centered; inner lip casts a soft occlusion onto tiles; tray shadow 8–12 px blur at 25% opacity. Grid gutters are hairline embossed grooves so tiles read as individual cards even in Big‑Cell mode.
- **pieces**: Tiles are rounded cards (6–10 px radius). Hidden: matte cream with gentle top highlight and bottom shadow; on press, depress 1 px. Revealed empty: slightly lighter paper with a faint debossed center. Numbers use a colorblind‑safe set with luminance steps: 1=#1E88E5, 2=#2E7D32, 3=#C0392B, 4=#6A5ACD, 5=#8E44AD, 6=#00897B, 7=#5D4037, 8=#607D8B; each sits as embossed ink with a soft inner shadow; behind each number a barely‑there micro‑icon (dot count/dashes) improves shape recognition at a glance. Flag: stitched fabric pin in accent red with tiny thread detail and micro‑flutter idle. Mine: abstract seed pod—rounded matte charcoal body with three pale seams and a ceramic rim highlight; no spikes or gore. Wrong‑flag/exploded states achieved via shaders: red glow rim and desaturation overlay.
- **hud**: Top status strip is a translucent parchment card with 12 px radius and inner padding; left shows Mines Remaining with a small seed‑pod icon, center shows mode/time, right holds a compact tool toggle (Reveal/Flag) that indicates state via color and icon; digits are high‑contrast ink on paper.
- **buttons**: Primary buttons are pill plates in primary green with a satin top edge and crisp white ink; Secondary are cream paper pills with ink text and a subtle outer stroke; both use 9‑slice for scaling and cast a 6 px soft shadow. Icon buttons (undo, hint, pause) are circular ceramic tokens with engraved icons.
- **typography**: Rounded geometric sans (e.g., Inter Rounded/Nunito style); numbers on tiles rendered via SDF for perfect zoom; body text 88–92% black‑brown ink for reduced glare; all sizes scale with Big‑Cell mode.
- **popups**: Stacked paper cards with layered drop shadows, corner radius 16–20 px; top bar holds a small leaf‑seal motif; buttons aligned bottom; backgrounds blur 6 px and dim to 30% for focus.
- **fx**: Reveal pop is a soft scale from 0.96→1 with a paper‑lift shadow bloom; cascades ripple with a low‑opacity chime sparkle. Win emits low‑density leaf confetti drifting downward; Loss adds a desaturation ripple from last tap and briefly outlines the mistake in a soft red halo.
- **motion**: 200 ms ease‑out for reveals, 120 ms press depress, 300 ms tray entrance on scene load; springy toggle (overshoot 8%) for tool switch; confetti drifts 1.2 s with slight rotation; respect reduced‑motion setting by cutting scale and replacing with fades; haptics: light tick on flag/place, soft thump on mine.

## Assets (assets/art, indexed in src/art.ts)
- `bg_parchment_cozy` (background, 1080x1920): menus, gameplay default theme
- `bg_garden_wood` (background, 1080x1920): alternate theme background
- `bg_night_sky` (background, 1080x1920): alternate theme background (Night)
- `board_tray_paperwood` (sprite, 511x512): container under the grid
- `tile_hidden_card` (sprite, 512x509): unrevealed grid cell
- `tile_revealed_empty` (sprite, 504x512): revealed empty cell
- `tile_number_glyph_sheet` (sprite, 445x512): overlay numbers 1–8 on revealed tiles
- `tile_flag_fabric` (sprite, 414x512): flag placed on a cell
- `tile_mine_seedpod` (sprite, 512x274): mine reveal/exploded
- `hud_panel_parchment` (ui, 512x278): top status bar background
- `button_primary_plate` (ui, 512x217): primary actions, tool toggle active
- `button_secondary_plate` (ui, 512x263): secondary actions
- `icon_reward_leaf` (sprite, 482x512): rewards, currency, win confetti seed
- `fx_sparkle_soft` (fx, 477x512): tile reveal and cascade highlights
- `fx_leaf_confetti_burst` (fx, 512x496): win celebration
- `hero_key_art_cozy_field` (character, 445x512): title screen hero illustration
- `logo` (ui, 900x455): the game logo — title/home screen and anywhere the name appears
