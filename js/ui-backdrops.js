// ============================================================================
// UI-BACKDROPS.JS — Layer 6b
// WHAT:  Maps your 8 backdrop images to UI screens (main menu, skill tree,
//        loading/buffer between runs, draft day) — separate from the
//        in-game venue backdrops used during actual runs (career-progression.js).
// HOW:   Simple index LUT into ASSET_MANIFEST.scene.backdrop's {n} frames.
//        Reuses the same 8 images across both UI and in-run venues (you only
//        have 8 photos — this is the intentional reuse plan, not a bug).
// WHEN:  Read by menus.js (future layer) whenever a non-gameplay screen needs
//        a backdrop image.
// WHY:   You specifically called out that some of these backdrops were meant
//        for menu/skill/buffer screens, not just in-game venues — this file
//        is where that intent lives as data.
// WHERE: js/ui-backdrops.js — depends on asset-manifest.js.
// WHO:   Assistant-A (mapping correctness). Assistant-B (does each screen's
//        chosen backdrop actually suit its mood — menu calm, loading neutral,
//        draft day exciting?).
// ============================================================================

defineModule('ui-backdrops.js', {
  what: 'Maps backdrop images to non-gameplay UI screens (menu/skill/loading/draft)',
  how: 'Simple index LUT into the same 8-image backdrop set career runs also use',
  when: 'Read by menu/loading screen code whenever a non-gameplay screen renders',
  why: 'Preserves your original intent: some backdrops are for UI, not just venues',
  where: 'js/ui-backdrops.js — depends on asset-manifest.js',
  who: 'Assistant-A (mapping), Assistant-B (mood fit per screen)',
  exports: ['UI_BACKDROPS', 'getUiBackdropPath'],
  dependsOn: ['contract.js', 'asset-manifest.js']
});

const UI_BACKDROPS = Object.freeze({
  MAIN_MENU:       6,
  SKILL_TREE:      7,
  LOADING_BUFFER:  8,
  DRAFT_DAY:       5,
  GAME_OVER:       3,
  CAREER_COMPLETE: 4
});

/**
 * @param {string} screenKey - key into UI_BACKDROPS
 * @returns {string} concrete asset path, e.g. 'assets/backdrops/6.jpeg'
 */
function getUiBackdropPath(screenKey) {
  const index = UI_BACKDROPS[screenKey];
  if (!index) throw new Error(`[ui-backdrops.js] Unknown UI screen key "${screenKey}"`);
  return ASSET_MANIFEST.scene.backdrop.path.replace('{n}', index);
}
