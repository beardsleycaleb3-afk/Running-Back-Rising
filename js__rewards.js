// ============================================================================
// REWARDS.JS — Layer 4e
// WHAT:  The addictive-loop engine: post-play loot rolls (gear drops, stars),
//        streak bonuses (consecutive clean plays), and special bonus rounds
//        (short high-reward mini-challenges between career stages).
// HOW:   Weighted random rolls off pure-data tables. Streak state tracked
//        as a simple counter on the player. Special rounds are just a flag
//        + modified spawner rules for a fixed duration.
// WHEN:  rollPostPlayLoot() called at the end of every play (BETWEEN_PLAYS
//        state entry). maybeTriggerSpecialRound() checked between career
//        stages.
// WHY:   Visible, frequent, escalating rewards are what make a runner "sticky"
//        — this isolates that entire feel into one file so tuning it later
//        (drop rates, streak thresholds) never touches gameplay code.
// WHERE: js/rewards.js — depends on config.js, gear.js.
// WHO:   Assistant-A (roll math/fairness — no rigged near-misses).
//        Assistant-B (does the reward CADENCE feel good, not grindy or
//        manipulative?).
// ============================================================================

defineModule('rewards.js', {
  what: 'Post-play loot rolls, streak bonuses, and special bonus round triggers',
  how: 'Weighted random tables + simple streak counters + timed special-round flag',
  when: 'Loot rolled at end of each play; special rounds checked between stages',
  why: 'Isolates the entire reward-cadence feel into one tunable file',
  where: 'js/rewards.js — depends on config.js, gear.js',
  who: 'Assistant-A (fair roll math), Assistant-B (reward cadence/feel, not manipulative)',
  exports: ['rollPostPlayLoot', 'updateStreak', 'maybeTriggerSpecialRound', 'SPECIAL_ROUNDS'],
  dependsOn: ['contract.js', 'config.js', 'gear.js']
});

// Weighted loot table. Weights are relative, not percentages — normalized at roll time.
const LOOT_TABLE = Object.freeze([
  { type: 'stars',      weight: 50, amountRange: [10, 40] },
  { type: 'gearTier1',  weight: 25, slots: ['cleats', 'shoulderPads', 'gloves', 'elbowPads'] },
  { type: 'gearTier2',  weight: 12, slots: ['cleats', 'shoulderPads', 'gloves', 'elbowPads'] },
  { type: 'gearTier3',  weight: 8,  slots: ['cleats', 'shoulderPads', 'gloves', 'elbowPads'] },
  { type: 'gearTier4',  weight: 2,  slots: ['cleats', 'shoulderPads', 'gloves', 'elbowPads'] },
  { type: 'skillPoint', weight: 3,  amountRange: [1, 1] }
]);

const STREAK_BONUS_THRESHOLDS = Object.freeze([
  { plays: 3,  bonusStars: 15,  label: '3-play streak!' },
  { plays: 6,  bonusStars: 40,  label: '6-play streak!!' },
  { plays: 10, bonusStars: 100, label: '10-play streak!!! On fire!' }
]);

const SPECIAL_ROUNDS = Object.freeze({
  STAR_RUSH:   { label: 'Star Rush',   durationSec: 15, spawnRule: { starMultiplier: 3, defenderMultiplier: 0.5 } },
  GAUNTLET:    { label: 'Gauntlet',    durationSec: 15, spawnRule: { starMultiplier: 1, defenderMultiplier: 2.0, lootBonusMultiplier: 3 } },
  GEAR_DROP:   { label: 'Gear Drop',   durationSec: 10, spawnRule: { guaranteedGearTier: 2 } }
});

/**
 * Rolls one loot result from the weighted table.
 * @returns {{type:string, detail:any}}
 */
function rollPostPlayLoot() {
  const totalWeight = LOOT_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of LOOT_TABLE) {
    if (roll < entry.weight) {
      if (entry.type === 'stars' || entry.type === 'skillPoint') {
        const [min, max] = entry.amountRange;
        const amount = Math.floor(min + Math.random() * (max - min + 1));
        return { type: entry.type, detail: { amount } };
      } else {
        const slot = entry.slots[Math.floor(Math.random() * entry.slots.length)];
        const tier = Number(entry.type.replace('gearTier', ''));
        return { type: 'gear', detail: { slot, tier } };
      }
    }
    roll -= entry.weight;
  }
  // Fallback (floating point edge case) — always resolves to something
  return { type: 'stars', detail: { amount: 10 } };
}

/**
 * Call after a successful clean play (no HP lost, or big gain). Advances the
 * streak counter and returns a bonus if a threshold was just crossed.
 * @param {object} streakState - { count: number } — mutated in place
 * @param {boolean} playWasClean
 * @returns {{label:string, bonusStars:number}|null}
 */
function updateStreak(streakState, playWasClean) {
  if (!playWasClean) {
    streakState.count = 0;
    return null;
  }
  streakState.count += 1;
  const hit = STREAK_BONUS_THRESHOLDS.find(t => t.plays === streakState.count);
  return hit ? { label: hit.label, bonusStars: hit.bonusStars } : null;
}

/**
 * Small chance to trigger a special round between career stages.
 * @param {number} chapterIndex
 * @returns {string|null} key into SPECIAL_ROUNDS, or null
 */
function maybeTriggerSpecialRound(chapterIndex) {
  const roll = Math.random();
  if (roll < 0.12) {
    const keys = Object.keys(SPECIAL_ROUNDS);
    return keys[Math.floor(Math.random() * keys.length)];
  }
  return null;
}
