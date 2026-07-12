// ============================================================================
// PHYSICS.JS — Layer 8b
// WHAT:  The real simulation: player lane-slide interpolation, forward
//        distance progress, merging gear+ability effects into one number
//        set, running collision checks against the spawner's active
//        defenders every frame, and triggering tackle/touchdown resolution
//        at the right moments.
// HOW:   One update(dt) call per fixed-step frame. Reads player.targetLane
//        (set by input/swipe) and lerps player.lane toward it over
//        LANE_SWITCH_MS. Tracks player.distanceRun toward the current run's
//        target distance. Merges gear.computeActiveEffects() +
//        abilityController.getActiveEffects() into one flat object each
//        frame (cheap — both are small objects) and passes it into
//        collision-resolution.js's pure functions.
// WHEN:  Called every fixed-step frame, but ONLY while game-state is
//        PLAYING — this is what makes "the field keeps rolling but nothing
//        gameplay-relevant changes during the overlay" actually true: the
//        render layers can still redraw for atmosphere, but physics.js
//        itself simply isn't ticked during BETWEEN_PLAYS/SKILL_MENU, so no
//        distance, collisions, or defender movement happen while a menu is up.
// WHY:   This is the file that makes every previous layer (gear, abilities,
//        collision-resolution, story, rewards) actually DO something during
//        real gameplay instead of existing only as tested-in-isolation logic.
// WHERE: js/physics.js — depends on config.js, gear.js, abilities.js,
//        collision-resolution.js, career-progression.js, story.js,
//        rewards.js, spawner.js.
// WHO:   Assistant-A (simulation correctness, no frame-rate-dependent bugs).
//        Assistant-B (does movement/collision feel responsive at 30fps on
//        the real phone?).
// ============================================================================

defineModule('physics.js', {
  what: 'Real player movement, effect merging, collision orchestration, run completion',
  how: 'One update(dt) per fixed-step frame, only ticked during PLAYING state',
  when: 'Every fixed-step frame; frozen (not called) during BETWEEN_PLAYS/SKILL_MENU',
  why: 'Makes gear/abilities/collision/story/rewards actually drive live gameplay',
  where: 'js/physics.js — depends on gear.js, abilities.js, collision-resolution.js, career-progression.js, story.js, rewards.js, spawner.js, smart-play.js, skill-tree.js',
  who: 'Assistant-A (simulation correctness), Assistant-B (feel at 30fps)',
  exports: ['createPhysicsWorld', 'DRAFT_ELIGIBLE_TEAMS'],
  dependsOn: ['contract.js', 'config.js', 'gear.js', 'abilities.js', 'collision-resolution.js', 'career-progression.js', 'story.js', 'rewards.js', 'spawner.js', 'smart-play.js', 'skill-tree.js']
});

const RUN_TARGET_DISTANCE = 100; // "yards" — arbitrary unit, tuned for run pacing

// Teams that never appear as an opponent in career-progression.js's PRO_GAMES
// runs (Bears/Vikings/Panthers/Cowboys/Miners are all opponents) — these are
// the pool the player can actually get DRAFTED to.
const DRAFT_ELIGIBLE_TEAMS = Object.freeze(['RIVERSIDE_TIGERS', 'SKYPORT_FALCONS', 'IRONGATE_LIONS']);

/**
 * @param {number} chapterIndex
 * @param {object} equippedGear - { cleats, shoulderPads, gloves, elbowPads } tier numbers
 * @param {object} abilityController - from abilities.js
 * @param {string|null} smartPlayCallId - the player's Smart Play choice for
 *   this run (key into SMART_PLAY_CALLS), passed straight through to the
 *   spawner (spawn pacing) and applied to touchdown rewards below
 * @param {object|null} saveData - full save.js save object, used to read
 *   skill tree allocations each frame (skill-tree.js:getSkillTreeEffects).
 *   Optional — physics.js works fine with no skill bonuses if omitted.
 * @returns {object} physics world instance
 */
function createPhysicsWorld(chapterIndex, equippedGear, abilityController, smartPlayCallId, saveData) {
  const run = getRun(chapterIndex);
  const spawner = createSpawner(chapterIndex, smartPlayCallId);
  const rewardBias = (smartPlayCallId && SMART_PLAY_CALLS[smartPlayCallId])
    ? SMART_PLAY_CALLS[smartPlayCallId].rewardBias
    : { lootMultiplier: 1, xpMultiplier: 1 };
  const streakState = { count: 0 };
  const laneMin = -Math.floor((GAME_CONFIG.LANE_COUNT - 1) / 2);
  const laneMax = Math.floor((GAME_CONFIG.LANE_COUNT - 1) / 2);

  const player = {
    lane: 0, targetLane: 0, laneSlideElapsedMs: 0,
    hp: GAME_CONFIG.MAX_HP, maxHp: GAME_CONFIG.MAX_HP,
    distanceRun: 0, runCyclePhase: 0, frame: 0,
    teamKey: null, invulnUntilSec: 0
  };

  let elapsedSec = 0;
  let runEnded = false;

  return {
    player, spawner, run, streakState,

    /** @param {number} direction -1 (left) or 1 (right) */
    requestLaneChange(direction) {
      player.targetLane = Math.max(laneMin, Math.min(laneMax, player.targetLane + direction));
    },

    /**
     * Advances the whole simulation by dt. Call ONLY while state is PLAYING.
     * @param {number} dt seconds
     * @returns {{ended:boolean, reason:string|null, resultPayload:object|null}}
     */
    update(dt) {
      if (runEnded) return { ended: true, reason: 'already-ended', resultPayload: null };
      elapsedSec += dt;
      abilityController.update(dt);

      // --- Lane slide interpolation (smooth over LANE_SWITCH_MS) -----------
      const laneDelta = player.targetLane - player.lane;
      if (Math.abs(laneDelta) > 0.001) {
        const step = (dt * 1000) / GAME_CONFIG.LANE_SWITCH_MS;
        player.lane += laneDelta * Math.min(1, step);
      } else {
        player.lane = player.targetLane;
      }

      // --- Merge gear + ability effects into one flat object ----------------
      const gearResult = computeActiveEffects(equippedGear);
      const abilityEffects = abilityController.getActiveEffects();
      const skillEffects = saveData ? getSkillTreeEffects(saveData) : {};
      const combinedEffects = { ...gearResult.totals, ...abilityEffects, ...skillEffects };
      for (const key of Object.keys(gearResult.totals)) {
        let sum = gearResult.totals[key];
        if (key in abilityEffects) sum += abilityEffects[key];
        if (key in skillEffects) sum += skillEffects[key];
        combinedEffects[key] = sum;
      }

      // --- Forward progress --------------------------------------------------
      const speedMult = (1 + (combinedEffects.topSpeedPct || 0)) *
        (combinedEffects.speedMultiplier || 1) * run.speedMultiplier;
      const effectiveSpeed = GAME_CONFIG.BASE_SPEED * speedMult;
      player.distanceRun += effectiveSpeed * dt * 0.02; // scaled down to fit RUN_TARGET_DISTANCE pacing
      player.runCyclePhase += dt * 10 * speedMult;

      // --- Spawner + defender approach ---------------------------------------
      const approachRate = 0.15 * run.speedMultiplier; // z-units/sec closing speed
      spawner.update(dt, approachRate);

      // --- Collision pass ------------------------------------------------------
      if (elapsedSec >= player.invulnUntilSec) {
        for (const defender of spawner.pool) {
          if (!defender.active) continue;
          if (!checkLaneCollision(player, defender)) continue;

          const result = resolveTackleCollision(player, defender, combinedEffects);
          player.hp = result.playerHpAfter;
          player.invulnUntilSec = elapsedSec + COLLISION_CONFIG.POST_TACKLE_INVULN_SEC;
          spawner.despawn(defender.poolIndex); // this defender's involved either way, clear the slot

          if (result.tackled) {
            return this._endRun('tackled', result);
          }
          break; // broke the tackle — only resolve one collision per frame
        }
      }

      // --- Touchdown check -----------------------------------------------------
      if (player.distanceRun >= RUN_TARGET_DISTANCE) {
        const tdResult = resolveTouchdown(player, streakState);
        // Apply this run's Smart Play reward bias — Play-Action Juke pays out
        // more, Inside Run less, as promised when the call was chosen.
        tdResult.xpAwarded = Math.round(tdResult.xpAwarded * rewardBias.xpMultiplier);
        if (tdResult.loot.type === 'stars' || tdResult.loot.type === 'skillPoint') {
          tdResult.loot.detail.amount = Math.round(tdResult.loot.detail.amount * rewardBias.lootMultiplier);
        }
        return this._endRun('touchdown', tdResult);
      }

      return { ended: false, reason: null, resultPayload: null };
    },

    /**
     * @param {string} reason - 'tackled' | 'touchdown'
     * @param {object} eventResult - from resolveTackleCollision or resolveTouchdown
     */
    _endRun(reason, eventResult) {
      runEnded = true;
      const performanceTier = classifyPerformance({ yardsGainedPct: player.hp / player.maxHp });
      const storyOutcome = getStoryOutcome(chapterIndex, performanceTier);
      return {
        ended: true, reason,
        resultPayload: { eventResult, performanceTier, storyOutcome, distanceRun: player.distanceRun }
      };
    }
  };
}
