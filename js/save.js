// ============================================================================
// SAVE.JS — Layer 4f
// WHAT:  Full save/load: career progress, unlocked HOF runners, owned gear
//        per slot/tier, XP/skill points spent, best streaks — everything
//        that should survive closing the app.
// HOW:   Single JSON blob in localStorage under one key, wrapped with a
//        `version` field. migrateSchema() upgrades old saves forward so a
//        future field addition never corrupts existing player saves.
// WHEN:  saveGame() called on every BETWEEN_PLAYS transition (cheap, frequent
//        checkpoints) and on app pagehide/visibilitychange (catches "phone
//        locked mid-game"). loadGame() called once at boot.
// WHY:   A career/RPG game is worthless if progress vanishes — this is the
//        single most important reliability file in the whole project.
// WHERE: js/save.js — depends on config.js.
// WHO:   Assistant-A (schema correctness/migration safety — never silently
//        lose player data). Assistant-B (does autosave feel invisible, never
//        janky/blocking?).
// ============================================================================

defineModule('save.js', {
  what: 'Full versioned save/load system (career, gear, unlocks, XP) via localStorage',
  how: 'Single JSON blob keyed by SAVE_KEY, versioned with forward migration',
  when: 'Saved on every BETWEEN_PLAYS transition + pagehide; loaded once at boot',
  why: 'Progress loss in an RPG runner is the single worst possible bug',
  where: 'js/save.js — depends on config.js',
  who: 'Assistant-A (schema/migration safety), Assistant-B (autosave feels invisible)',
  exports: ['createDefaultSave', 'saveGame', 'loadGame', 'CURRENT_SAVE_VERSION'],
  dependsOn: ['contract.js', 'config.js']
});

const SAVE_KEY = 'rbr_save_v1';
const CURRENT_SAVE_VERSION = 1;

/**
 * @returns {object} a brand-new save for a first-time player
 */
function createDefaultSave() {
  return {
    version: CURRENT_SAVE_VERSION,
    career: {
      currentStageId: 'HS_SCOUT',
      chaptersCompleted: 0,
      teamKey: null,
      superBowlWins: 0,
      careerComplete: false
    },
    stats: {
      totalStars: 0,
      totalTacklesBroken: 0,
      totalJukesLanded: 0,
      bestStreak: 0
    },
    xp: { level: 1, currentXp: 0, skillPointsAvailable: 0, skillTreeAllocations: {} },
    gear: {
      owned: { cleats: [], shoulderPads: [], gloves: [], elbowPads: [] }, // arrays of owned tiers
      equipped: { cleats: 0, shoulderPads: 0, gloves: 0, elbowPads: 0 }   // 0 = none equipped
    },
    unlockedRunners: [],
    settings: { musicOn: true, sfxOn: true }
  };
}

/**
 * Upgrades an older save forward to CURRENT_SAVE_VERSION. Add a new
 * `if (save.version === N) { ...patch...; save.version = N+1; }` block
 * every time the schema changes — never delete/rewrite old blocks.
 * @param {object} save
 * @returns {object} migrated save
 */
function migrateSchema(save) {
  // No migrations yet (version 1 is the first schema). Future example:
  // if (save.version === 1) {
  //   save.stats.totalYardsGained = 0; // new field added in v2
  //   save.version = 2;
  // }
  return save;
}

/**
 * @param {object} saveData
 * @returns {boolean} true if the write succeeded
 */
function saveGame(saveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (err) {
    console.error('[save.js] Save failed (storage full or unavailable):', err);
    return false;
  }
}

/**
 * @returns {object} the loaded (and migrated) save, or a fresh default if
 *                    none exists or the stored data is corrupted
 */
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSave();

    const parsed = JSON.parse(raw);
    if (typeof parsed.version !== 'number') {
      console.warn('[save.js] Save missing version field — starting fresh.');
      return createDefaultSave();
    }
    return migrateSchema(parsed);
  } catch (err) {
    console.error('[save.js] Save corrupted, starting fresh:', err);
    return createDefaultSave();
  }
}
