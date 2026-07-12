// ============================================================================
// ASSET-MANIFEST.JS — Layer 3a
// WHAT:  The ONE place that lists every asset path used in the entire game.
//        Nothing else in the codebase should ever write a literal "assets/..."
//        string — everything asks this manifest for a path by key.
// HOW:   Plain nested object, `required: true/false` marks whether the file
//        MUST exist to boot vs. is allowed to be missing (falls back to a
//        drawn silhouette via sprite-loader.js). This is exactly how you
//        add art over time without breaking anything: drop a correctly
//        named file into the folder, and it silently upgrades from
//        silhouette to real sprite the next time you load the page.
// WHEN:  Read once by sprite-loader.js at boot to know what to fetch.
// WHY:   You said you want to add exact-named files at your own pace without
//        getting overwhelmed. This file IS that contract with your future
//        self: "name it this, put it here, and it just works."
// WHERE: js/asset-manifest.js — depends on nothing (pure data).
// WHO:   Assistant-A maintains the shape/keys. You (or Assistant-B) fill in
//        real filenames as you produce/find art.
// ============================================================================

defineModule('asset-manifest.js', {
  what: 'Single source of truth mapping every asset key to its exact file path',
  how: 'Plain nested object with required:true/false per entry',
  when: 'Read once at boot by sprite-loader.js',
  why: 'Lets you add real art incrementally by filename alone, zero code changes',
  where: 'js/asset-manifest.js — no dependencies, pure data',
  who: 'Assistant-A (shape/keys), you/Assistant-B (fill in real files over time)',
  exports: ['ASSET_MANIFEST'],
  dependsOn: ['contract.js']
});

/**
 * Every entry: { path: 'assets/...', required: bool, frames: number (optional) }
 * `frames` on an entry with a `{n}` in its path means sprite-loader.js will
 * try to load path.replace('{n}', 1), path.replace('{n}', 2), ... up to frames.
 */
const ASSET_MANIFEST = Object.freeze({

  // --- PLAYER / MASCOT (per-team run-cycle frames) -------------------------
  // Only BENGALS has a real frame right now (from your existing r1.png).
  // Add more teams by dropping e.g. assets/sprites/player/running/bears/1.png
  player: {
    RIVERSIDE_TIGERS: { path: 'assets/sprites/player/running/1.png', frames: 1, required: true  },
    GRANITE_BEARS:    { path: 'assets/sprites/player/running/bears/{n}.png',    frames: 4, required: false },
    SKYPORT_FALCONS:  { path: 'assets/sprites/player/running/falcons/{n}.png',  frames: 4, required: false },
    IRONGATE_LIONS:   { path: 'assets/sprites/player/running/lions/{n}.png',    frames: 4, required: false }
    // TODO: remaining fictional teams — same {n}.png frame convention
  },

  // --- DEFENDERS (grouped by TEAM you're facing, not by position — a
  // defender's look changes based on WHO you're running against that level,
  // per the original naming convention: b/c/m/p/v = team-specific sets,
  // "generic" = HS/college/practice runs with no named opponent yet.
  // career-progression.js's opponentTeam field on each run tells the
  // spawner which of these sets to pull from.) --------------------------
  defenders: {
    GENERIC:           { path: 'assets/sprites/defenders/generic/{n}.png',  frames: 2, required: true },
    GRANITE_BEARS:     { path: 'assets/sprites/defenders/bears/{n}.png',    frames: 4, required: true },
    LONESTAR_COWBOYS:  { path: 'assets/sprites/defenders/cowboys/{n}.png',  frames: 4, required: true },
    SIERRA_MINERS:     { path: 'assets/sprites/defenders/miners/{n}.png',   frames: 3, required: true },
    PIEDMONT_PANTHERS: { path: 'assets/sprites/defenders/panthers/{n}.png', frames: 2, required: true },
    NORTHLAND_VIKINGS: { path: 'assets/sprites/defenders/vikings/{n}.png',  frames: 4, required: true }
    // TODO: SKYPORT_FALCONS / IRONGATE_LIONS / RIVERSIDE_TIGERS don't have
    // opponent runs yet in career-progression.js — add a defender set here
    // if/when they get scheduled as an opponent.
  },

  // --- SCENE (backdrops/grass/endzones — all real already) ----------------
  scene: {
    backdrop:  { path: 'assets/backdrops/{n}.jpeg',    frames: 8, required: true },
    grass:     { path: 'assets/grass/grass{n}.png',     frames: 9, zeroIndexed: true, required: true },
    endzone:   { path: 'assets/endzones/endzone{n}.png', frames: 8, zeroIndexed: true, required: true },
    // NOT YET REAL — venue-specific stadium art called out in checklist below
    stadiumOpen:     { path: 'assets/sprites/scene/stadium_open.png',     required: false },
    stadiumEnclosed: { path: 'assets/sprites/scene/stadium_enclosed.png', required: false },
    hsFieldBleachers:{ path: 'assets/sprites/scene/hs_bleachers.png',     required: false }
  },

  // --- ITEMS / POWERUPS (sheets exist, need slicing coords once you confirm
  //     the grid — for now sprite-loader.js treats these as single images) --
  items: {
    sheet: { path: 'assets/sprites/items/sheet.png', required: true }
  },
  powerups: {
    sheet: { path: 'assets/sprites/powerups/sheet.png', required: true }
  },

  // --- UI ICONS (none exist yet — silhouette fallback covers all of these) -
  ui: {
    // Action buttons + ability icons — REAL generated SVG art, not silhouettes
    btnSprint:      { path: 'assets/ui/icons/btn_sprint.svg',      required: true },
    btnJukeLeft:    { path: 'assets/ui/icons/btn_juke_left.svg',   required: true },
    btnJukeRight:   { path: 'assets/ui/icons/btn_juke_right.svg',  required: true },
    btnStiffArm:    { path: 'assets/ui/icons/btn_stiff_arm.svg',   required: true },
    abilityGhost:   { path: 'assets/ui/icons/ability_ghost.svg',   required: true },
    abilityTank:    { path: 'assets/ui/icons/ability_tank.svg',    required: true },
    abilityTurbo:   { path: 'assets/ui/icons/ability_turbo.svg',   required: true },
    abilityPower:   { path: 'assets/ui/icons/ability_power.svg',   required: true },
    abilitySpeed:   { path: 'assets/ui/icons/ability_speed.svg',   required: true },
    abilityTricky:  { path: 'assets/ui/icons/ability_tricky.svg',  required: true },
    coachPortrait:  { path: 'assets/ui/icons/coach_portrait.svg',  required: true },
    // Skill tree nodes — REAL generated SVG art
    skillNodeSpeed: { path: 'assets/ui/skilltree/node_speed.svg',  required: true },
    skillNodePower: { path: 'assets/ui/skilltree/node_power.svg',  required: true },
    skillNodeVision:{ path: 'assets/ui/skilltree/node_vision.svg', required: true },
    skillNodeHands: { path: 'assets/ui/skilltree/node_hands.svg',  required: true }
  },

  // --- GEAR ICONS (REAL generated SVG art, 4 slots x 4 tiers = 16 icons) ---
  gearIcons: {
    cleatsTier1: { path: 'assets/ui/gear/cleats_tier1.svg', required: true },
    cleatsTier2: { path: 'assets/ui/gear/cleats_tier2.svg', required: true },
    cleatsTier3: { path: 'assets/ui/gear/cleats_tier3.svg', required: true },
    cleatsTier4: { path: 'assets/ui/gear/cleats_tier4.svg', required: true },
    shoulderPadsTier1: { path: 'assets/ui/gear/shoulderpads_tier1.svg', required: true },
    shoulderPadsTier2: { path: 'assets/ui/gear/shoulderpads_tier2.svg', required: true },
    shoulderPadsTier3: { path: 'assets/ui/gear/shoulderpads_tier3.svg', required: true },
    shoulderPadsTier4: { path: 'assets/ui/gear/shoulderpads_tier4.svg', required: true },
    glovesTier1: { path: 'assets/ui/gear/gloves_tier1.svg', required: true },
    glovesTier2: { path: 'assets/ui/gear/gloves_tier2.svg', required: true },
    glovesTier3: { path: 'assets/ui/gear/gloves_tier3.svg', required: true },
    glovesTier4: { path: 'assets/ui/gear/gloves_tier4.svg', required: true },
    elbowPadsTier1: { path: 'assets/ui/gear/elbowpads_tier1.svg', required: true },
    elbowPadsTier2: { path: 'assets/ui/gear/elbowpads_tier2.svg', required: true },
    elbowPadsTier3: { path: 'assets/ui/gear/elbowpads_tier3.svg', required: true },
    elbowPadsTier4: { path: 'assets/ui/gear/elbowpads_tier4.svg', required: true }
  },

  // --- AUDIO (nothing exists yet) ------------------------------------------
  audio: {
    sfxTackleHit:   { path: 'assets/audio/sfx/tackle_hit.mp3',    required: false },
    sfxJukeWhoosh:  { path: 'assets/audio/sfx/juke_whoosh.mp3',   required: false },
    sfxCrowdSmall:  { path: 'assets/audio/sfx/crowd_small.mp3',   required: false },
    sfxCrowdBig:    { path: 'assets/audio/sfx/crowd_big.mp3',     required: false },
    sfxWhistle:     { path: 'assets/audio/sfx/whistle.mp3',       required: false },
    sfxLevelUp:     { path: 'assets/audio/sfx/level_up.mp3',      required: false },
    sfxDraftFanfare:{ path: 'assets/audio/sfx/draft_fanfare.mp3', required: false },
    musicMenu:      { path: 'assets/audio/music/menu_loop.mp3',      required: false },
    musicGameLow:   { path: 'assets/audio/music/game_loop_low.mp3',  required: false },
    musicGameHigh:  { path: 'assets/audio/music/game_loop_high.mp3', required: false },
    musicVictory:   { path: 'assets/audio/music/victory_stinger.mp3',required: false }
  }
});
