# Asset Checklist — Running Back Rising

**Note:** This is a fictional parody league — no real NFL/NCAA team names, logos,
or exact colors. Team keys are things like `RIVERSIDE_TIGERS`, `GRANITE_BEARS`,
`SKYPORT_FALCONS`, `IRONGATE_LIONS`. Add more fictional teams the same way.

**Player sprite frames should be 128px wide × 256px tall (portrait)** — that's
the fixed display size in `js/config.js` (`PLAYER_WIDTH`/`PLAYER_HEIGHT`). Any
source image works, but 128×256 (or a clean multiple, e.g. 256×512) avoids
stretching.

Everything below is read by `js/asset-manifest.js`. Drop a file at the **exact path**
listed, reload the page, and it upgrades from a gray silhouette to real art —
no code changes needed, ever.

## ✅ Already working (your existing repo assets, already copied in)
- `assets/backdrops/1.jpeg` … `8.jpeg`
- `assets/grass/grass0.png` … `grass8.png`
- `assets/endzones/endzone0.png` … `endzone7.png`
- `assets/sprites/defenders/bears/1.png`…`4.png` (Granite Bears — your old b1-b4)
- `assets/sprites/defenders/cowboys/1.png`…`4.png` (Lonestar Cowboys — your old c1-c4)
- `assets/sprites/defenders/generic/1.png`…`2.png` (HS/college/practice, no named opponent — your old d1/d3)
- `assets/sprites/defenders/miners/1.png`…`3.png` (Sierra Miners — your old m1-m3)
- `assets/sprites/defenders/panthers/1.png`…`2.png` (Piedmont Panthers — your old p1-p2)
- `assets/sprites/defenders/vikings/1.png`…`4.png` (Northland Vikings — your old v1-v4)
- `assets/sprites/player/running/1.png` (Riverside Tigers only, 1 frame)
- `assets/sprites/items/sheet.png`, `assets/sprites/powerups/sheet.png` (raw sheets, not yet sliced)

## ❌ Still needed — silhouettes cover these until you upload

### Player mascots (one folder per fictional team, `{n}.png` = run-cycle frame)
```
assets/sprites/player/running/bears/1.png ... 4.png      (Granite Bears)
assets/sprites/player/running/falcons/1.png ... 4.png    (Skyport Falcons)
assets/sprites/player/running/lions/1.png ... 4.png      (Irongate Lions)
```
(Add remaining fictional teams the same way — same 4-frame run cycle shape.)

### Hall of Fame unlockable runners
```
assets/sprites/player/running/hof_bullet/1.png ... 4.png
assets/sprites/player/running/hof_iron/1.png ... 4.png
assets/sprites/player/running/hof_ghost/1.png ... 4.png
assets/sprites/player/running/hof_legend/1.png ... 4.png
```

### Gear icons (inventory/equip screen — 4 tiers each, cosmetic only for now)
```
assets/ui/gear/cleats_tier1.png ... tier4.png
assets/ui/gear/shoulderpads_tier1.png ... tier4.png
assets/ui/gear/gloves_tier1.png ... tier4.png
assets/ui/gear/elbowpads_tier1.png ... tier4.png
```

### Scene / venue art
```
assets/sprites/scene/stadium_open.png       (open-air pro stadium silhouette/skyline)
assets/sprites/scene/stadium_enclosed.png   (domed/enclosed stadium)
assets/sprites/scene/hs_bleachers.png       (small high school field bleachers)
```

### UI icons (touch buttons + skill tree nodes)
```
assets/ui/icons/btn_sprint.png
assets/ui/icons/btn_juke_left.png
assets/ui/icons/btn_juke_right.png
assets/ui/icons/btn_stiff_arm.png
assets/ui/skilltree/node_speed.png
assets/ui/skilltree/node_power.png
assets/ui/skilltree/node_vision.png
assets/ui/skilltree/node_hands.png
assets/ui/coach_portrait.png
```

### Audio (SFX — short one-shots)
```
assets/audio/sfx/tackle_hit.mp3
assets/audio/sfx/juke_whoosh.mp3
assets/audio/sfx/crowd_small.mp3
assets/audio/sfx/crowd_big.mp3
assets/audio/sfx/whistle.mp3
assets/audio/sfx/level_up.mp3
assets/audio/sfx/draft_fanfare.mp3
```

### Audio (music — loops)
```
assets/audio/music/menu_loop.mp3
assets/audio/music/game_loop_low.mp3
assets/audio/music/game_loop_high.mp3
assets/audio/music/victory_stinger.mp3
```

## How to add one
1. Make/find the art or sound.
2. Name it **exactly** as shown above.
3. Put it in that exact folder in the repo.
4. Reload the page (or push to GitHub if using GitHub Pages). Open the browser
   console — `sprite-loader.js` prints a warning list of everything still
   missing, so you always know what's left.

Everything not yet uploaded silently renders as a colored silhouette (gray
for defenders, green for scene, gold for items, purple for powerups) — the
game is always playable, never broken, while you fill this in at your own pace.
