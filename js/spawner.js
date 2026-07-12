// ============================================================================
// SPAWNER.JS — Layer 8a
// WHAT:  Owns the defender pool — a FIXED-SIZE array (never grows/shrinks,
//        no per-frame allocation) where "spawning" means reactivating a
//        currently-inactive slot instead of pushing a new object. This is
//        the queue/dequeue pattern applied to entities instead of render
//        layers: a small free-list of indices, dequeued when spawning,
//        enqueued back when a defender is tackled/juked/despawned.
// HOW:   pool = fixed array of MAX_ONSCREEN_DEFENDERS slots, all inactive at
//        start. freeIndices = array acting as a stack (push/pop, O(1)).
//        spawnOne() pops a free index, configures that slot, done.
//        despawn(index) resets the slot and pushes the index back.
// WHEN:  update(dt) called every fixed-step frame during PLAYING. Spawns a
//        new defender at a random lane at z=1 (horizon) on a timer based on
//        the current run's defenderCountCap + speedMultiplier, further
//        biased by the player's chosen Smart Play call for this run (see
//        smart-play.js) — Inside Run spawns fewer/slower, Play-Action Juke
//        spawns more/faster.
// WHY:   On a 3GB-RAM Helio G25, allocating/discarding objects every few
//        seconds for the life of a run would churn the garbage collector.
//        A fixed pool means ZERO allocation after boot — spawning is just
//        flipping a few fields on an already-allocated object.
// WHERE: js/spawner.js — depends on config.js, career-progression.js.
// WHO:   Assistant-A (pool integrity — no leaked slots, no double-spawns on
//        the same index). Assistant-B (does spawn pacing/lane distribution
//        feel fair, not cheap or random-unfair?).
// ============================================================================

defineModule('spawner.js', {
  what: 'Fixed-capacity defender pool with a dequeue-style free-index stack — zero per-frame allocation',
  how: 'Pre-allocated array + free-index stack; spawn = pop+configure, despawn = reset+push',
  when: 'update(dt) every fixed-step frame during PLAYING; spawns on a run-tuned timer',
  why: 'Zero GC churn on a 3GB-RAM device — no objects created/destroyed mid-run',
  where: 'js/spawner.js — depends on config.js, career-progression.js, smart-play.js',
  who: 'Assistant-A (pool integrity), Assistant-B (spawn pacing/fairness)',
  exports: ['createSpawner'],
  dependsOn: ['contract.js', 'config.js', 'career-progression.js', 'smart-play.js']
});

/**
 * @param {number} chapterIndex - which run this spawner is configured for
 * @param {string|null} smartPlayCallId - the player's chosen Smart Play call
 *   for this run (key into SMART_PLAY_CALLS), or null for no bias applied
 * @returns {object} spawner instance
 */
function createSpawner(chapterIndex, smartPlayCallId) {
  const run = getRun(chapterIndex);
  const teamKey = getDefenderTeamKey(chapterIndex);
  const capacity = GAME_CONFIG.MAX_ONSCREEN_DEFENDERS;
  const laneMin = -Math.floor((GAME_CONFIG.LANE_COUNT - 1) / 2);
  const laneMax = Math.floor((GAME_CONFIG.LANE_COUNT - 1) / 2);

  // Fixed pool, pre-allocated once. Never resized.
  const pool = [];
  const freeIndices = []; // stack: dequeue-style reuse of inactive slots
  for (let i = 0; i < capacity; i++) {
    pool.push({ lane: 0, z: 1, teamKey, frame: 0, isTackling: false, active: false, poolIndex: i });
    freeIndices.push(i);
  }

  // Smart Play bias applied here: Inside Run spawns fewer/slower, Play-Action
  // Juke spawns more/faster — a real, felt consequence of the between-play
  // choice, not just a reward-pool multiplier off in rewards.js.
  const call = smartPlayCallId ? SMART_PLAY_CALLS[smartPlayCallId] : null;
  const countMult = (call && call.spawnBias.defenderCountMultiplier) || 1.0;

  const spawnIntervalSec = Math.max(0.5, (2.2 / (run ? run.speedMultiplier : 1)) / countMult);
  const maxConcurrent = Math.max(1, Math.round((run ? run.defenderCountCap : 4) * countMult));

  return {
    pool, teamKey, spawnIntervalSec, maxConcurrent,
    timeSinceLastSpawn: 0,

    /** @returns {number} how many pool slots are currently active */
    activeCount() {
      return pool.filter(d => d.active).length;
    },

    /**
     * Pops a free slot (if any) and configures it as a newly-spawned defender.
     * No-op (does nothing) if the pool is full or at this run's concurrent cap.
     */
    spawnOne() {
      if (freeIndices.length === 0) return; // pool fully active, can't spawn more
      if (this.activeCount() >= maxConcurrent) return; // this run's cap reached

      const index = freeIndices.pop(); // dequeue a free slot
      const slot = pool[index];
      slot.lane = laneMin + Math.floor(Math.random() * (laneMax - laneMin + 1));
      slot.z = 1;
      slot.frame = Math.floor(Math.random() * 3); // cosmetic variety, clamped by renderer to real frame count
      slot.isTackling = false;
      slot.active = true;
    },

    /**
     * Resets a slot and returns its index to the free stack (enqueue).
     * @param {number} index
     */
    despawn(index) {
      const slot = pool[index];
      slot.active = false;
      slot.isTackling = false;
      freeIndices.push(index);
    },

    /**
     * Advances the spawn timer and spawns when it's time. Also despawns
     * any defender that's scrolled past the player (z < 0) without a
     * collision — e.g. one you successfully ran past in another lane.
     * @param {number} dt seconds
     * @param {number} approachRate - z units/sec defenders close the gap by
     */
    update(dt, approachRate) {
      this.timeSinceLastSpawn += dt;
      if (this.timeSinceLastSpawn >= spawnIntervalSec) {
        this.timeSinceLastSpawn = 0;
        this.spawnOne();
      }

      for (const slot of pool) {
        if (!slot.active) continue;
        slot.z -= approachRate * dt;
        if (slot.z < -0.05) {
          this.despawn(slot.poolIndex); // ran past cleanly, free the slot
        }
      }
    }
  };
}
