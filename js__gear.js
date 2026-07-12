// ============================================================================
// GEAR.JS — Layer 4c
// WHAT:  Collectible equipment: cleats, shoulder pads, gloves, elbow pads.
//        Each item has a tier (1-4: Practice/Starter/Pro/Legendary) with
//        scaling stat bonuses, plus set-bonus conditions evaluated via
//        logic-gates.js.
// HOW:   GEAR_CATALOG is pure data (LUT). computeActiveEffects() walks the
//        player's equipped slots, sums stat bonuses, then checks SET_BONUSES
//        conditions against a flat context object using evaluateGate().
// WHEN:  Recomputed any time gear changes (equip/unequip/pickup+auto-equip).
//        Cached on the player object as `player.gearEffects` so physics.js
//        never has to recompute per-frame.
// WHY:   "Reward system that's addicting" needs equipment progression the
//        player can SEE working (numbers going up) — this file is the whole
//        mechanism, decoupled entirely from rendering or physics.
// WHERE: js/gear.js — depends on config.js, logic-gates.js, trie.js.
// WHO:   Assistant-A (data integrity, stacking math). Assistant-B (does tier
//        progression feel rewarding, are set bonuses fun to chase?).
// ============================================================================

defineModule('gear.js', {
  what: 'Collectible gear (cleats/shoulder pads/gloves/elbow pads) with tiered stat bonuses + set bonuses',
  how: 'Pure-data catalog, effects summed per equip slot, set bonuses via logic-gates.js',
  when: 'Recomputed on any equip/unequip change, cached on player.gearEffects',
  why: 'Visible equipment progression is the core "addicting reward" mechanism',
  where: 'js/gear.js — depends on config.js, logic-gates.js, trie.js',
  who: 'Assistant-A (data/stacking correctness), Assistant-B (progression feel)',
  exports: ['GEAR_CATALOG', 'SET_BONUSES', 'createGearTrie', 'computeActiveEffects'],
  dependsOn: ['contract.js', 'config.js', 'logic-gates.js', 'trie.js']
});

const GEAR_TIERS = Object.freeze({
  1: { label: 'Practice',  colorHex: '#8a8a8a' },
  2: { label: 'Starter',   colorHex: '#3fa34d' },
  3: { label: 'Pro',       colorHex: '#3f7fd6' },
  4: { label: 'Legendary', colorHex: '#d6a13f' }
});

// Each slot has 4 tiers with scaling effect magnitude. Pure data — adding a
// new gear item later is just adding a row here, no code changes.
const GEAR_CATALOG = Object.freeze({
  cleats: {
    slot: 'cleats',
    tiers: {
      1: { effect: { topSpeedPct: 0.02 } },
      2: { effect: { topSpeedPct: 0.05, accelPct: 0.02 } },
      3: { effect: { topSpeedPct: 0.09, accelPct: 0.05 } },
      4: { effect: { topSpeedPct: 0.14, accelPct: 0.08, breakawaySpeedPct: 0.05 } }
    }
  },
  shoulderPads: {
    slot: 'shoulderPads',
    tiers: {
      1: { effect: { tackleBreakChance: 0.03 } },
      2: { effect: { tackleBreakChance: 0.07, maxHpFlat: 5 } },
      3: { effect: { tackleBreakChance: 0.12, maxHpFlat: 12 } },
      4: { effect: { tackleBreakChance: 0.20, maxHpFlat: 25, stiffArmChance: 0.05 } }
    }
  },
  gloves: {
    slot: 'gloves',
    tiers: {
      1: { effect: { fumbleChanceReduction: 0.03 } },
      2: { effect: { fumbleChanceReduction: 0.07, catchRadiusExtraPct: 0.04 } },
      3: { effect: { fumbleChanceReduction: 0.12, catchRadiusExtraPct: 0.08 } },
      4: { effect: { fumbleChanceReduction: 0.20, catchRadiusExtraPct: 0.15, starMagnetChance: 0.05 } }
    }
  },
  elbowPads: {
    slot: 'elbowPads',
    tiers: {
      1: { effect: { warningRangeExtra: 0.5 } },
      2: { effect: { warningRangeExtra: 1,   slowmoOnJukePct: 0.03 } },
      3: { effect: { warningRangeExtra: 1.5, slowmoOnJukePct: 0.06 } },
      4: { effect: { warningRangeExtra: 2,   slowmoOnJukePct: 0.10, highlightHolesChance: 0.10 } }
    }
  }
});

// Set bonuses expressed as logic-gate condition trees over a flat context
// built from the player's equipped tiers, e.g. { 'cleats.tier': 3, ... }
const SET_BONUSES = Object.freeze([
  {
    id: 'SPEED_DEMON',
    label: 'Speed Demon (Cleats + Gloves, both Pro+)',
    condition: {
      gate: 'AND',
      children: [
        { check: 'cleats.tier', op: '>=', value: 3 },
        { check: 'gloves.tier', op: '>=', value: 3 }
      ]
    },
    effect: { topSpeedPct: 0.06 }
  },
  {
    id: 'BRICK_WALL',
    label: 'Brick Wall (Shoulder Pads Legendary, Elbow Pads NOT tier 1)',
    condition: {
      gate: 'AND',
      children: [
        { check: 'shoulderPads.tier', op: '==', value: 4 },
        { gate: 'NOT', children: [{ check: 'elbowPads.tier', op: '==', value: 1 }] }
      ]
    },
    effect: { maxHpFlat: 15, tackleBreakChance: 0.05 }
  },
  {
    id: 'FULL_LEGEND',
    label: 'Full Legendary Kit (all 4 slots at tier 4)',
    condition: {
      gate: 'AND',
      children: [
        { check: 'cleats.tier', op: '==', value: 4 },
        { check: 'shoulderPads.tier', op: '==', value: 4 },
        { check: 'gloves.tier', op: '==', value: 4 },
        { check: 'elbowPads.tier', op: '==', value: 4 }
      ]
    },
    effect: { breakawaySpeedPct: 0.10, starMagnetChance: 0.10, highlightHolesChance: 0.20 }
  }
]);

/**
 * Builds a trie indexing every gear item + tier for fast lookup/search.
 * @returns {object} trie instance (see trie.js)
 */
function createGearTrie() {
  const t = createTrie();
  for (const [slotName, slotData] of Object.entries(GEAR_CATALOG)) {
    for (const [tierNum, tierData] of Object.entries(slotData.tiers)) {
      const key = `${slotName}_tier${tierNum}`;
      t.insert(key, { slot: slotName, tier: Number(tierNum), ...tierData });
    }
  }
  return t;
}

/**
 * Sums equipped gear effects + applies any triggered set bonuses.
 * @param {object} equipped - { cleats: tierNumber|0, shoulderPads: ..., gloves: ..., elbowPads: ... }
 * @returns {object} flat effect object, e.g. { topSpeedPct: 0.15, maxHpFlat: 20, ... }
 */
function computeActiveEffects(equipped) {
  const totals = {};
  const addEffect = (effect) => {
    for (const [key, val] of Object.entries(effect)) {
      totals[key] = (totals[key] || 0) + val;
    }
  };

  const context = {};
  for (const [slot, tier] of Object.entries(equipped)) {
    context[`${slot}.tier`] = tier;
    if (tier > 0 && GEAR_CATALOG[slot] && GEAR_CATALOG[slot].tiers[tier]) {
      addEffect(GEAR_CATALOG[slot].tiers[tier].effect);
    }
  }

  const triggeredSets = [];
  for (const set of SET_BONUSES) {
    if (evaluateGate(set.condition, context)) {
      addEffect(set.effect);
      triggeredSets.push(set.id);
    }
  }

  return { totals, triggeredSets };
}
