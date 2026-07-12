// ============================================================================
// CONFIG.JS — Layer 1b
// WHAT:  Every tunable number/const/LUT in the entire game. If a number
//        controls gameplay, rendering, or timing, it lives HERE — nowhere else.
// HOW:   Frozen plain objects (Object.freeze) so nothing can mutate a "const"
//        by accident deep in some other module.
// WHEN:  Loaded second, right after contract.js. Every other module reads
//        from GAME_CONFIG / TEAM_MASCOTS / SKILL_TREES but never writes to them.
// WHY:   30fps target + Helio G25 means every module needs to agree on the
//        SAME frame budget and difficulty curve. One source of truth prevents
//        e.g. spawner.js and physics.js disagreeing on speed and causing
//        impossible-to-dodge obstacles.
// WHERE: js/config.js — depends only on contract.js.
// WHO:   Assistant-A (systems) drafts structure/LUTs. Assistant-B (feel)
//        tunes the actual numbers after playtesting on the real phone.
// ============================================================================

defineModule('config.js', {
  what: 'All tunable constants, LUTs, and per-device performance targets',
  how: 'Frozen plain objects, read-only from every other module',
  when: 'Loaded second, immediately after contract.js',
  why: 'Single source of truth for numbers so modules never disagree',
  where: 'js/config.js — depends on contract.js only',
  who: 'Assistant-A drafts, Assistant-B tunes after real-device playtesting',
  exports: ['GAME_CONFIG', 'TEAM_MASCOTS', 'SKILL_TREES', 'CAREER_STAGES'],
  dependsOn: ['contract.js']
});

// ----------------------------------------------------------------------------
// PERFORMANCE TARGET — this is the number that changes if you ever switch
// phones. Everything else (spawn rates, animation frame timing) derives from
// this so the game FEELS the same even if the fps target changes later.
// ----------------------------------------------------------------------------
const GAME_CONFIG = Object.freeze({
  // Display — logical game area (not counting the HUD border frame around it).
  // We use dvh (dynamic viewport height) at the CSS layer so this fits real
  // mobile chrome/URL-bar show/hide behavior correctly; GAME_WIDTH/HEIGHT
  // here are the logical canvas resolution the game simulates at.
  GAME_WIDTH: 360,
  GAME_HEIGHT: 640,
  TARGET_FPS: 30,                 // <-- your target. Frame budget = 33.3ms.
  FIXED_DT_MS: 1000 / 30,         // sim step size, independent of render fps
  MAX_FRAME_SKIP: 4,              // clamp spiral-of-death if the phone stutters
  DPR_CAP: 2,                     // cap devicePixelRatio so canvas backbuffer
                                   // never exceeds ~720x1280 physical px on G25

  // HUD frame — border chrome around the play area
  BOTTOM_BORDER_PX: 80,           // thick bottom control strip, buttons live here
  BUTTON_DIAMETER_PX: 50,         // round action buttons, centered in the border
  FRAME_BORDER_PX: 6,             // thin decorative border around the whole screen

  // Lanes (2.5D lane runner) — 7 lanes, indices run -3..-2..-1..0..1..2..3
  LANE_COUNT: 7,
  LANE_SWITCH_MS: 150,             // time to slide one lane on swipe (snappier for 7 lanes)
  LANE_NEAR_SPREAD_PX: 46,         // screen-px offset per lane step at z=0 (closest)
  LANE_FAR_SPREAD_PX: 10,          // screen-px offset per lane step at z=1 (horizon)

  // 2.5D projection — horizon sits just above the halfway point of the play
  // area, matching "right above halfway" on the visible game height.
  HORIZON_Y_RATIO: 0.46,           // fraction of GAME_HEIGHT; resolved to px at boot
  NEAR_SCALE: 1.6,
  FAR_SCALE: 0.35,

  // Player sprite — fixed size, anchored just above the bottom border
  PLAYER_WIDTH: 128,
  PLAYER_HEIGHT: 256,

  // Movement
  BASE_SPEED: 220,                 // world units/sec at chapter start
  SPEED_RAMP_PER_CHAPTER: 18,      // world units/sec added per chapter

  // Combat/health
  MAX_HP: 100,
  OBSTACLE_BASE_DAMAGE: 18,

  // Collectibles
  STAR_VALUE: 10,

  // RPG
  TOTAL_CHAPTERS: 12,  // matches sum of CAREER_STAGES[].chapters below (2+1+2+4+1+1+1)
  XP_CURVE_BASE: 100,
  XP_CURVE_EXP: 1.55,

  // Perf safety valves specific to the Helio G25 target
  MAX_ONSCREEN_DEFENDERS: 6,       // pool cap — never spawn more than this at once
  MAX_ONSCREEN_PARTICLES: 40,      // pool cap for dust/spark/confetti particles
  ATLAS_MAX_DIMENSION: 2048        // safe universal texture size ceiling
});

// ----------------------------------------------------------------------------
// FICTIONAL LEAGUE — parody-level, NOT tied to real NFL/NCAA team names,
// logos, or exact color trademarks. Mascot archetypes only (animal + city
// vibe), original color pairings. Safe to publish without likeness issues.
// ----------------------------------------------------------------------------
const TEAM_MASCOTS = Object.freeze({
  RIVERSIDE_TIGERS:   { mascot: 'tiger',  primary: '#E86A17', secondary: '#111111', spriteSet: 'tiger',   homeCity: 'Riverside'  },
  GRANITE_BEARS:      { mascot: 'bear',   primary: '#1B2A41', secondary: '#8C5A2B', spriteSet: 'bear',    homeCity: 'Chicago-ish (Granite City)' },
  SKYPORT_FALCONS:    { mascot: 'falcon', primary: '#8E1B2E', secondary: '#C0C0C0', spriteSet: 'falcon',  homeCity: 'Skyport' },
  IRONGATE_LIONS:     { mascot: 'lion',   primary: '#2C6E9E', secondary: '#D9A441', spriteSet: 'lion',    homeCity: 'Irongate' },
  NORTHLAND_VIKINGS:  { mascot: 'viking', primary: '#3B2F6B', secondary: '#C7A03A', spriteSet: 'viking',  homeCity: 'Minnesota-ish (Northland)' },
  PIEDMONT_PANTHERS:  { mascot: 'panther',primary: '#1A5C46', secondary: '#0D0D0D', spriteSet: 'panther', homeCity: 'Carolina-ish (Piedmont)' },
  LONESTAR_COWBOYS:   { mascot: 'cowboy', primary: '#0C2340', secondary: '#B0B7BC', spriteSet: 'cowboy',  homeCity: 'Dallas-ish (Lonestar)' },
  SIERRA_MINERS:      { mascot: 'miner',  primary: '#A8262C', secondary: '#C0C0C0', spriteSet: 'miner',   homeCity: 'Bay-ish (Sierra)' }
  // TODO: remaining fictional teams — same shape, original mascot/color combos
});

// ----------------------------------------------------------------------------
// SKILL TREES — data-driven, no code branches per skill. requires: null means
// it's a root node available at level 1.
// ----------------------------------------------------------------------------
const SKILL_TREES = Object.freeze({
  SPEED: {
    node1:    { cost: 1, effect: { topSpeedPct: 0.05 },        requires: null },
    node2:    { cost: 2, effect: { accelPct: 0.08 },           requires: 'node1' },
    ultimate: { cost: 5, effect: { breakawaySpeedPct: 0.15 },  requires: 'node2' }
  },
  POWER: {
    node1:    { cost: 1, effect: { stiffArmChance: 0.10 },     requires: null },
    node2:    { cost: 2, effect: { tackleBreakChance: 0.15 },  requires: 'node1' },
    ultimate: { cost: 5, effect: { truckStickUnlocked: true }, requires: 'node2' }
  },
  VISION: {
    node1:    { cost: 1, effect: { warningRangeExtra: 1 },     requires: null },
    node2:    { cost: 2, effect: { slowmoOnJukePct: 0.10 },    requires: 'node1' },
    ultimate: { cost: 5, effect: { highlightHolesUnlocked: true }, requires: 'node2' }
  },
  HANDS: {
    node1:    { cost: 1, effect: { fumbleChanceReduction: 0.05 }, requires: null },
    node2:    { cost: 2, effect: { catchRadiusExtraPct: 0.10 }, requires: 'node1' },
    ultimate: { cost: 5, effect: { starMagnetUnlocked: true }, requires: 'node2' }
  }
});

// ----------------------------------------------------------------------------
// CAREER STAGES — the full arc from HS scout to Hall of Fame.
// ----------------------------------------------------------------------------
const CAREER_STAGES = Object.freeze([
  { id: 'HS_SCOUT',         label: 'High School Scouted', chapters: 2, unlockAtChapter: 0  },
  { id: 'COLLEGE_BOWL',     label: 'College Bowl Game',    chapters: 1, unlockAtChapter: 2  },
  { id: 'COLLEGE_PRACTICE', label: 'College Practice',     chapters: 2, unlockAtChapter: 3  },
  { id: 'PRO_GAMES',        label: 'Pro Season',           chapters: 4, unlockAtChapter: 5  },
  { id: 'SUPER_BOWL',       label: 'Super Bowl',           chapters: 1, unlockAtChapter: 9  },
  { id: 'PRO_BOWL',         label: 'Pro Bowl',             chapters: 1, unlockAtChapter: 10 },
  { id: 'HOF_GAME',         label: 'Hall of Fame Game',    chapters: 1, unlockAtChapter: 11 }
]);

/**
 * XP needed to reach a given level. Pure function, no side effects.
 * @param {number} level
 * @returns {number} total XP required
 */
function xpRequiredForLevel(level) {
  return Math.floor(GAME_CONFIG.XP_CURVE_BASE * Math.pow(level, GAME_CONFIG.XP_CURVE_EXP));
}
