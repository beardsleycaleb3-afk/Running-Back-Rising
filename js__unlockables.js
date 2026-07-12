// ============================================================================
// UNLOCKABLES.JS — Layer 4d
// WHAT:  Hall of Fame runners — fictional legendary player skins the player
//        unlocks by hitting career milestones. Each has a unique stat
//        profile (a fun "build") and its own sprite set.
// HOW:   Pure-data catalog + isUnlocked(id, playerCareerStats) check function.
// WHEN:  Checked after every career stage completion (career.js will call
//        checkNewUnlocks()); unlocked ones become selectable on the menu
//        screen for the NEXT run.
// WHY:   Fictional legends (not real player likenesses) give collection-goal
//        motivation without any likeness/rights concerns.
// WHERE: js/unlockables.js — depends on config.js.
// WHO:   Assistant-A (unlock condition correctness). Assistant-B (are the
//        HOF runner names/builds fun and worth chasing?).
// ============================================================================

defineModule('unlockables.js', {
  what: 'Hall of Fame fictional runner skins, unlocked via career milestones',
  how: 'Pure-data catalog + isUnlocked() pure check function',
  when: 'Checked after every career stage completion',
  why: 'Collection-goal motivation without touching real player likenesses',
  where: 'js/unlockables.js — depends on config.js',
  who: 'Assistant-A (unlock logic), Assistant-B (runner build/name design)',
  exports: ['HOF_RUNNERS', 'isUnlocked', 'getUnlockedRunners'],
  dependsOn: ['contract.js', 'config.js']
});

const HOF_RUNNERS = Object.freeze({
  BULLET_MCCOY: {
    label: 'Bullet McCoy',
    flavor: 'A blur nobody could line up.',
    spriteSet: 'hof_bullet',
    statBonus: { topSpeedPct: 0.15, accelPct: 0.10 },
    unlockCheck: (stats) => stats.superBowlWins >= 1
  },
  IRON_HENRIETTA: {
    label: 'Iron Henrietta',
    flavor: 'Never met a tackle she liked.',
    spriteSet: 'hof_iron',
    statBonus: { maxHpFlat: 30, tackleBreakChance: 0.15 },
    unlockCheck: (stats) => stats.chaptersCompleted >= 8 && stats.totalTacklesBroken >= 50
  },
  GHOST_OYELARAN: {
    label: 'Ghost Oyelaran',
    flavor: 'Defenders swore they saw him twice.',
    spriteSet: 'hof_ghost',
    statBonus: { slowmoOnJukePct: 0.15, warningRangeExtra: 2 },
    unlockCheck: (stats) => stats.totalJukesLanded >= 100
  },
  HALL_OF_FAME_LEGEND: {
    label: 'The Legend',
    flavor: 'Unlocked it all. Wear it proud.',
    spriteSet: 'hof_legend',
    statBonus: { topSpeedPct: 0.10, maxHpFlat: 20, fumbleChanceReduction: 0.10 },
    unlockCheck: (stats) => stats.careerComplete === true // finished HOF_GAME career stage
  }
});

/**
 * @param {string} runnerId - key into HOF_RUNNERS
 * @param {object} careerStats - player's lifetime stats object
 * @returns {boolean}
 */
function isUnlocked(runnerId, careerStats) {
  const runner = HOF_RUNNERS[runnerId];
  if (!runner) return false;
  return runner.unlockCheck(careerStats);
}

/**
 * @param {object} careerStats
 * @returns {string[]} ids of all currently unlocked runners
 */
function getUnlockedRunners(careerStats) {
  return Object.keys(HOF_RUNNERS).filter(id => isUnlocked(id, careerStats));
}
