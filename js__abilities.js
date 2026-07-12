// ============================================================================
// ABILITIES.JS — Layer 5a
// WHAT:  Timed cooldown abilities: Ghost Mode, Tank Mode, Turbo Mode,
//        Power Run, Speed Run, Tricky Run. Each has a duration (how long the
//        effect lasts once activated) and a cooldown (how long until it can
//        be used again).
// HOW:   Pure-data catalog (ABILITY_CATALOG) + a controller that tracks
//        per-ability state: { onCooldownUntil, activeUntil }. activate(id)
//        only succeeds if off cooldown; getActiveEffects() sums whatever's
//        currently active, same flat-effect shape gear.js and skills use so
//        physics.js can merge all three sources with one addEffect() call.
// WHEN:  update(dt) ticked every fixed-step frame. activate(id) called from
//        input.js when an ability button is tapped.
// WHY:   You want addictive, readable "big moment" buttons — abilities need
//        a strict off/on/cooldown state machine so the UI (cooldown ring)
//        and the actual gameplay effect never disagree.
// WHERE: js/abilities.js — depends on config.js.
// WHO:   Assistant-A (cooldown/timing correctness). Assistant-B (are the six
//        abilities differentiated enough to feel worth choosing between?).
// ============================================================================

defineModule('abilities.js', {
  what: 'Six timed cooldown abilities (Ghost/Tank/Turbo/Power/Speed/Tricky Run)',
  how: 'Pure-data catalog + per-ability {onCooldownUntil, activeUntil} state machine',
  when: 'update(dt) every fixed-step frame; activate(id) on button tap',
  why: 'Strict state machine keeps cooldown-ring UI and real effect always in sync',
  where: 'js/abilities.js — depends on config.js',
  who: 'Assistant-A (timing correctness), Assistant-B (ability differentiation/feel)',
  exports: ['ABILITY_CATALOG', 'createAbilityController'],
  dependsOn: ['contract.js', 'config.js']
});

const ABILITY_CATALOG = Object.freeze({
  GHOST_MODE: {
    label: 'Ghost Mode',
    durationSec: 4,
    cooldownSec: 25,
    effect: { intangible: true },                    // pass through defenders, no tackle rolls
    iconKey: 'ability_ghost'
  },
  TANK_MODE: {
    label: 'Tank Mode',
    durationSec: 5,
    cooldownSec: 30,
    effect: { damageReductionPct: 0.6, knockbackImmune: true },
    iconKey: 'ability_tank'
  },
  TURBO_MODE: {
    label: 'Turbo Mode',
    durationSec: 3,
    cooldownSec: 20,
    effect: { speedMultiplier: 1.6 },
    iconKey: 'ability_turbo'
  },
  POWER_RUN: {
    label: 'Power Run',
    durationSec: 4,
    cooldownSec: 22,
    effect: { tackleBreakChance: 0.5 },
    iconKey: 'ability_power'
  },
  SPEED_RUN: {
    label: 'Speed Run',
    durationSec: 4,
    cooldownSec: 22,
    effect: { topSpeedPct: 0.3 },
    iconKey: 'ability_speed'
  },
  TRICKY_RUN: {
    label: 'Tricky Run',
    durationSec: 4,
    cooldownSec: 22,
    effect: { slowmoOnJukePct: 0.25, laneSwitchInstant: true },
    iconKey: 'ability_tricky'
  }
});

/**
 * @returns {object} an ability controller instance, tracks all 6 abilities
 */
function createAbilityController() {
  const state = {};
  for (const id of Object.keys(ABILITY_CATALOG)) {
    state[id] = { onCooldownUntil: 0, activeUntil: 0 };
  }

  return {
    state,
    elapsedSec: 0,

    /** Call once per fixed-step frame. @param {number} dt seconds */
    update(dt) {
      this.elapsedSec += dt;
    },

    /**
     * @param {string} id - key into ABILITY_CATALOG
     * @returns {boolean} true if it activated, false if still on cooldown
     */
    activate(id) {
      const def = ABILITY_CATALOG[id];
      const s = state[id];
      if (!def || !s) return false;
      if (this.elapsedSec < s.onCooldownUntil) return false; // still cooling down

      s.activeUntil = this.elapsedSec + def.durationSec;
      s.onCooldownUntil = this.elapsedSec + def.cooldownSec;
      return true;
    },

    /**
     * @param {string} id
     * @returns {{ready:boolean, cooldownRemainingSec:number, activeRemainingSec:number}}
     */
    getStatus(id) {
      const s = state[id];
      if (!s) return { ready: false, cooldownRemainingSec: 0, activeRemainingSec: 0 };
      return {
        ready: this.elapsedSec >= s.onCooldownUntil,
        cooldownRemainingSec: Math.max(0, s.onCooldownUntil - this.elapsedSec),
        activeRemainingSec: Math.max(0, s.activeUntil - this.elapsedSec)
      };
    },

    /**
     * Sums the effects of every CURRENTLY ACTIVE ability (usually 0 or 1 at
     * a time, but stacking multiple isn't blocked — your call in playtesting
     * whether that should change).
     * @returns {object} flat effect object, same shape as gear.js effects
     */
    getActiveEffects() {
      const totals = {};
      for (const [id, def] of Object.entries(ABILITY_CATALOG)) {
        if (this.elapsedSec < state[id].activeUntil) {
          for (const [key, val] of Object.entries(def.effect)) {
            totals[key] = typeof val === 'boolean' ? (totals[key] || false) || val
              : (totals[key] || 0) + val;
          }
        }
      }
      return totals;
    }
  };
}
