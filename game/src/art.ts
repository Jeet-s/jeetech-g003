/** Game art (assets/art/manifest.json: kind/usage/size; "legacy" ids are the previous art). Use with expo Image or Skia useImage. */
export const art = {
  bg_parchment_cozy: require("../assets/art/bg_parchment_cozy.png"),
  bg_garden_wood: require("../assets/art/bg_garden_wood.png"),
  bg_night_sky: require("../assets/art/bg_night_sky.png"),
  board_tray_paperwood: require("../assets/art/board_tray_paperwood.png"),
  tile_hidden_card: require("../assets/art/tile_hidden_card.png"),
  tile_revealed_empty: require("../assets/art/tile_revealed_empty.png"),
  tile_number_glyph_sheet: require("../assets/art/tile_number_glyph_sheet.png"),
  tile_flag_fabric: require("../assets/art/tile_flag_fabric.png"),
  tile_mine_seedpod: require("../assets/art/tile_mine_seedpod.png"),
  hud_panel_parchment: require("../assets/art/hud_panel_parchment.png"),
  button_primary_plate: require("../assets/art/button_primary_plate.png"),
  button_secondary_plate: require("../assets/art/button_secondary_plate.png"),
  icon_reward_leaf: require("../assets/art/icon_reward_leaf.png"),
  fx_sparkle_soft: require("../assets/art/fx_sparkle_soft.png"),
  fx_leaf_confetti_burst: require("../assets/art/fx_leaf_confetti_burst.png"),
  hero_key_art_cozy_field: require("../assets/art/hero_key_art_cozy_field.png"),
  logo: require("../assets/art/logo.png"),
} as const;
export type ArtId = keyof typeof art;
