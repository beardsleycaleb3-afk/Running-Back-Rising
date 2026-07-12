// ============================================================================
// AI-COACH.JS — Layer 9c
// WHAT:  The hint/tip system — a coach character who fires contextual advice
//        based on trigger rules (first tackle seen, HP low, unspent skill
//        points, missed a star row, etc), not hardcoded scattered ifs.
// HOW:   COACH_TIPS is pure data: id -> message. TRIGGER_RULES is a list of
//        { id, check(context), cooldownSec } — check() is a pure predicate
//        against a flat context object built each frame. evaluateTriggers()
//        returns at most one tip per call (highest-priority match), and
//        respects a per-tip cooldown so the same tip doesn't spam.
// WHEN:  evaluateTriggers(context) called once per fixed-step frame from
//        render-core.js, fed a context object built from physicsWorld +
//        saveData. Fires into a toast queue the HUD reads from.
// WHY:   This was designed in the very first planning pass and never built —
//        closing it now.
// WHERE: js/ai-coach.js — depends on config.js.
// WHO:   Assistant-A (trigger correctness, no rule fires every frame forever).
//        Assistant-B (are the tips actually useful, worded like a coach and
//        not a tutorial popup?).
// ============================================================================

defineModule('ai-coach.js', {
  what: 'Contextual coach hint system — trigger rules fire tips based on live game state',
  how: 'Pure predicate rules against a flat context object, per-tip cooldown, one tip per call max',
  when: 'evaluateTriggers() once per fixed-step frame, fed live physics/save state',
  why: 'Designed in the original planning pass, never built until now',
  where: 'js/ai-coach.js — depends on config.js',
  who: 'Assistant-A (trigger/cooldown correctness), Assistant-B (tip usefulness/voice)',
  exports: ['COACH_TIPS', 'createCoachState', 'evaluateTriggers'],
  dependsOn: ['contract.js', 'config.js']
});

const COACH_TIPS = Object.freeze({
  ON_FIRST_DEFENDER: "Swipe to change lanes — timing beats speed early on.",
  ON_LOW_HP: "You're banged up. Tank Mode or a stiff-arm gear bonus can bail you out here.",
  ON_UNSPENT_SKILL_POINTS: "You've got skill points sitting unspent — check the tree between plays.",
  ON_UNSPENT_GEAR: "You picked up new gear but haven't equipped it. Tap Manage Gear.",
  ON_STREAK_BUILDING: "Nice streak going. One more clean play and the bonus kicks in.",
  ON_ABILITY_READY: "An ability's off cooldown — this is a good spot to use it.",
  ON_FIRST_TOUCHDOWN: "That's how it's done. Keep that same vision on the next one."
});

// Order matters — first matching rule wins each call. Higher-value/rarer
// tips go first so a "first defender" tip doesn't crowd out something more
// urgent like low HP later in the same run.
const TRIGGER_RULES = Object.freeze([
  { id: 'ON_LOW_HP', cooldownSec: 20, check: (ctx) => ctx.player.hp / ctx.player.maxHp < 0.3 },
  { id: 'ON_FIRST_TOUCHDOWN', cooldownSec: 999999, check: (ctx) => ctx.justScoredFirstTouchdown === true },
  { id: 'ON_STREAK_BUILDING', cooldownSec: 30, check: (ctx) => ctx.streakCount >= 2 },
  { id: 'ON_UNSPENT_SKILL_POINTS', cooldownSec: 25, check: (ctx) => ctx.skillPointsAvailable > 0 && ctx.isBetweenPlays },
  { id: 'ON_UNSPENT_GEAR', cooldownSec: 25, check: (ctx) => ctx.hasUnequippedGear && ctx.isBetweenPlays },
  { id: 'ON_ABILITY_READY', cooldownSec: 20, check: (ctx) => ctx.anyAbilityReady && ctx.isPlaying },
  { id: 'ON_FIRST_DEFENDER', cooldownSec: 999999, check: (ctx) => ctx.defenderCountSeen >= 1 && !ctx.seenFirstDefenderTip }
]);

/**
 * @returns {object} fresh coach state — tracks cooldowns + one-time flags
 */
function createCoachState() {
  return {
    lastFiredAt: {}, // tip id -> elapsedSec it last fired
    elapsedSec: 0,
    toastQueue: [],
    seenFirstDefenderTip: false,
    seenFirstTouchdownTip: false
  };
}

/**
 * @param {object} coachState
 * @param {number} dt seconds
 * @param {object} context - flat object built by the caller each frame, e.g.:
 *   { player, isPlaying, isBetweenPlays, streakCount, skillPointsAvailable,
 *     hasUnequippedGear, anyAbilityReady, defenderCountSeen,
 *     justScoredFirstTouchdown, seenFirstDefenderTip }
 * @returns {string|null} a tip message if one fired this frame, else null
 */
function evaluateTriggers(coachState, dt, context) {
  coachState.elapsedSec += dt;
  context.seenFirstDefenderTip = coachState.seenFirstDefenderTip;

  for (const rule of TRIGGER_RULES) {
    const lastFired = coachState.lastFiredAt[rule.id] || -Infinity;
    if (coachState.elapsedSec - lastFired < rule.cooldownSec) continue;
    if (!rule.check(context)) continue;

    coachState.lastFiredAt[rule.id] = coachState.elapsedSec;
    if (rule.id === 'ON_FIRST_DEFENDER') coachState.seenFirstDefenderTip = true;
    return COACH_TIPS[rule.id];
  }
  return null;
}
