// ============================================================================
// COLLISION-RESOLUTION.JS — Layer 6c
// WHAT:  The exact answer to "what happens when you get tackled" and "what
//        happens when you score a TD." Two pure functions, real consts,
//        no ambiguity about what fires when.
// HOW:   resolveTackleCollision() runs when the player's hitbox overlaps a
//        defender's hitbox in the same lane. It rolls tackle-break chance
//        (from gear + skills + abilities), then either breaks the tackle
//        (play continues) or gets tackled (damage, state transition,
//        fumble roll). resolveTouchdown() runs when the player's Z crosses
//        the TD line. Both return a result object — they do NOT mutate
//        game-state.js directly, so physics.js (next layer) stays in
//        control of exactly when/how the state machine reacts.
// WHEN:  Called every fixed-step frame from physics.js's collision pass
//        (once that module exists) — for now this file is the complete,
//        testable logic layer, ready to be called.
// WHY:   You asked exactly this: "you get tackled then what happens, if you
//        score a TD what happens" — this file IS the literal answer, in
//        code, not just prose.
// WHERE: js/collision-resolution.js — depends on config.js, gear.js,
//        abilities.js, rewards.js.
// WHO:   Assistant-A (roll math correctness, no exploitable edge cases).
//        Assistant-B (does a tackle FEEL fair — enough warning, enough
//        counterplay via skill/gear/ability?).
// ============================================================================

defineModule('collision-resolution.js', {
  what: 'Exact tackle and touchdown resolution logic — the core moment-to-moment ruleset',
  how: 'Two pure functions returning result objects; callers own all state mutation',
  when: 'Called from physics.js collision pass every fixed-step frame (next layer)',
  why: 'Direct, testable answer to "what happens on tackle" and "what happens on TD"',
  where: 'js/collision-resolution.js — depends on config.js, gear.js, abilities.js, rewards.js',
  who: 'Assistant-A (roll math correctness), Assistant-B (does it feel fair?)',
  exports: ['COLLISION_CONFIG', 'resolveTackleCollision', 'resolveTouchdown', 'checkLaneCollision'],
  dependsOn: ['contract.js', 'config.js', 'gear.js', 'abilities.js', 'rewards.js']
});

const COLLISION_CONFIG = Object.freeze({
  // Hitbox tolerance — how close in z (depth) a defender must be to the
  // player before a tackle roll can even happen. Player is always at z≈0.08.
  TACKLE_TRIGGER_Z: 0.12,

  // Base chance the DEFENDER lands the tackle before any player bonuses.
  BASE_TACKLE_SUCCESS_CHANCE: 0.55,

  // Damage dealt on a successful (non-broken) tackle.
  TACKLE_BASE_DAMAGE: 18,

  // Chance a successful tackle also causes a fumble (separate roll).
  BASE_FUMBLE_CHANCE: 0.08,

  // Z value the player must reach (moving toward z=1, the horizon/endzone)
  // to score. In practice the "run distance" for a chapter, not raw z —
  // physics.js will map total yards run to this trigger; kept here as the
  // named constant this file's logic is built around.
  TOUCHDOWN_TRIGGER: 'CHAPTER_DISTANCE_COMPLETE',

  // Post-tackle recovery window (seconds) before the player is vulnerable
  // to a second tackle roll — prevents instant double-hits feeling unfair.
  POST_TACKLE_INVULN_SEC: 0.6
});

/**
 * Checks whether a defender is close enough (same lane, within trigger Z)
 * to attempt a tackle this frame.
 * @param {object} player - { lane, z (~0.08 constant) }
 * @param {object} defender - { lane, z, active }
 * @returns {boolean}
 */
function checkLaneCollision(player, defender) {
  if (!defender.active) return false;
  const sameLane = Math.round(defender.lane) === Math.round(player.lane);
  const closeEnough = defender.z <= COLLISION_CONFIG.TACKLE_TRIGGER_Z;
  return sameLane && closeEnough;
}

/**
 * Resolves one tackle attempt. Pure function — caller applies the result.
 * @param {object} player - { hp, maxHp }
 * @param {object} defender - { type }
 * @param {object} combinedEffects - merged gear+skills+abilities flat effect
 *   object (see gear.js computeActiveEffects + abilities.js getActiveEffects)
 * @returns {{
 *   tackled: boolean,        // true = play stops here
 *   brokeTackle: boolean,    // true = player broke free, play continues
 *   damage: number,          // HP lost, 0 if tackle was broken
 *   fumbled: boolean,        // true = ball lost, turnover
 *   playerHpAfter: number,
 *   logMessage: string
 * }}
 */
function resolveTackleCollision(player, defender, combinedEffects) {
  const tackleBreakChance = combinedEffects.tackleBreakChance || 0;
  const stiffArmChance = combinedEffects.stiffArmChance || 0;
  const intangible = combinedEffects.intangible === true; // Ghost Mode

  if (intangible) {
    return {
      tackled: false, brokeTackle: true, damage: 0, fumbled: false,
      playerHpAfter: player.hp,
      logMessage: 'Ran clean through the tackle attempt — Ghost Mode active.'
    };
  }

  // Total break chance is the defender's base success chance reduced by the
  // player's tackle-break + stiff-arm bonuses (both fight the same roll).
  const effectiveBreakChance = Math.min(0.9, tackleBreakChance + stiffArmChance);
  const tackleRoll = Math.random();
  const brokeTackle = tackleRoll < effectiveBreakChance;

  if (brokeTackle) {
    return {
      tackled: false, brokeTackle: true, damage: 0, fumbled: false,
      playerHpAfter: player.hp,
      logMessage: `Broke the tackle attempt from the ${defender.type}!`
    };
  }

  // Tackle lands. Damage reduced by damageReductionPct (e.g. Tank Mode).
  const damageReduction = combinedEffects.damageReductionPct || 0;
  const damage = Math.round(COLLISION_CONFIG.TACKLE_BASE_DAMAGE * (1 - damageReduction));
  const playerHpAfter = Math.max(0, player.hp - damage);

  // Fumble roll, reduced by fumbleChanceReduction from gloves/gear.
  const fumbleReduction = combinedEffects.fumbleChanceReduction || 0;
  const effectiveFumbleChance = Math.max(0, COLLISION_CONFIG.BASE_FUMBLE_CHANCE - fumbleReduction);
  const fumbled = Math.random() < effectiveFumbleChance;

  return {
    tackled: true, brokeTackle: false, damage, fumbled, playerHpAfter,
    logMessage: fumbled
      ? `Tackled by the ${defender.type} — FUMBLE! Turnover.`
      : `Tackled by the ${defender.type} for ${damage > 0 ? 'a stop' : 'no gain'}.`
  };
}

/**
 * Resolves a touchdown. Pure function — caller applies rewards/state change.
 * @param {object} player - { level, teamKey }
 * @param {object} streakState - from rewards.js updateStreak, passed through
 * @returns {{
 *   points: number, xpAwarded: number, loot: object,
 *   streakBonus: object|null, logMessage: string
 * }}
 */
function resolveTouchdown(player, streakState) {
  const points = 7; // TD + extra point, keeping it simple/arcade rather than simulating kicks
  const xpAwarded = 50;
  const loot = rollPostPlayLoot();
  const streakBonus = updateStreak(streakState, true); // a TD always counts as a "clean play"

  return {
    points, xpAwarded, loot, streakBonus,
    logMessage: `TOUCHDOWN! +${points} points, +${xpAwarded} XP.`
  };
}
