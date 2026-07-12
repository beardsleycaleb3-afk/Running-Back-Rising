// ============================================================================
// SMART-PLAY.JS — Layer 6d
// WHAT:  "Smart Play" — a 3-option play-call choice presented to the player
//        during BETWEEN_PLAYS, before the next play starts. Each option
//        biases that upcoming play's defender spawn pattern AND its reward
//        pool differently, so the choice is a real risk/reward decision,
//        not flavor text.
// HOW:   Pure-data catalog of play calls. selectSmartPlay(id) stores the
//        chosen call's spawnBias/rewardBias on a "pending play" object that
//        spawner.js (future layer) reads when the next play starts, and
//        rewards.js reads when that play ends.
// WHEN:  Options presented every time game-state.js enters BETWEEN_PLAYS.
//        Auto-picks a safe default (BALANCED_ATTACK) if the player doesn't
//        choose before clock.js's play-clock countdown hits zero — this is
//        what makes the "auto-resume" in game-state.js meaningful instead
//        of leaving the next play unconfigured.
// WHY:   This is the actual interactivity between plays you asked for — a
//        real decision with real consequences, every single play, not just
//        a "tap to continue."
// WHERE: js/smart-play.js — depends on config.js.
// WHO:   Assistant-A (bias math, no dominant strategy that trivializes
//        choice). Assistant-B (are the 3 options fun to read and pick
//        between at a glance, every play, without getting stale?).
// ============================================================================

defineModule('smart-play.js', {
  what: 'Interactive 3-option play-call system presented every BETWEEN_PLAYS',
  how: 'Pure-data catalog; selection biases next play spawn pattern + reward pool',
  when: 'Presented on every BETWEEN_PLAYS entry; auto-defaults if play-clock expires',
  why: 'Real risk/reward decision every play, not a "tap to continue" placeholder',
  where: 'js/smart-play.js — depends on config.js',
  who: 'Assistant-A (bias/balance math), Assistant-B (choice variety/freshness)',
  exports: ['SMART_PLAY_CALLS', 'createSmartPlayState', 'selectSmartPlay', 'getDefaultSmartPlay'],
  dependsOn: ['contract.js', 'config.js']
});

const SMART_PLAY_CALLS = Object.freeze({
  INSIDE_RUN: {
    label: 'Inside Run',
    flavor: 'Fewer defenders, tighter lanes, safer yards.',
    spawnBias: { defenderCountMultiplier: 0.7, laneWidthMultiplier: 0.85 },
    rewardBias: { lootMultiplier: 0.8, xpMultiplier: 1.0 }
  },
  OUTSIDE_SWEEP: {
    label: 'Outside Sweep',
    flavor: 'Wide open field, but the fast defenders are waiting.',
    spawnBias: { defenderCountMultiplier: 1.0, laneWidthMultiplier: 1.2 },
    rewardBias: { lootMultiplier: 1.1, xpMultiplier: 1.15 }
  },
  PLAY_ACTION_JUKE: {
    label: 'Play-Action Juke',
    flavor: 'High risk, high reward — defenders converge, but the payoff is big.',
    spawnBias: { defenderCountMultiplier: 1.3, laneWidthMultiplier: 1.0 },
    rewardBias: { lootMultiplier: 1.5, xpMultiplier: 1.4 }
  }
});

const DEFAULT_SMART_PLAY = 'INSIDE_RUN'; // safe fallback if the play-clock expires unpicked

/**
 * @returns {object} fresh smart-play state for a new game/career
 */
function createSmartPlayState() {
  return { pendingCallId: null, lastCallId: null };
}

/**
 * @param {object} smartPlayState
 * @param {string} callId - key into SMART_PLAY_CALLS
 * @returns {boolean} true if selection succeeded
 */
function selectSmartPlay(smartPlayState, callId) {
  if (!SMART_PLAY_CALLS[callId]) return false;
  smartPlayState.pendingCallId = callId;
  return true;
}

/**
 * Called by clock.js's auto-resume path if the player never picked.
 * @param {object} smartPlayState
 */
function getDefaultSmartPlay(smartPlayState) {
  if (!smartPlayState.pendingCallId) {
    smartPlayState.pendingCallId = DEFAULT_SMART_PLAY;
  }
  return smartPlayState.pendingCallId;
}
