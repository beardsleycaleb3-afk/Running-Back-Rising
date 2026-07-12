// ============================================================================
// SKILL-TREE.JS — Layer 9a
// WHAT:  Spends skill points into SKILL_TREES (config.js) — SPEED/POWER/
//        VISION/HANDS, each with node1 -> node2 -> ultimate, prerequisite-gated.
// HOW:   allocateSkillPoint() checks cost + prerequisite against saveData,
//        deducts skillPointsAvailable, records the allocation. getSkillTreeEffects()
//        sums every allocated node's effect into one flat object, same shape
//        as gear.js/abilities.js so physics.js can merge all three sources.
// WHEN:  allocateSkillPoint() called from the overlay's SKILLS tab tap
//        handler. getSkillTreeEffects() called once per physics.js frame,
//        same as gear/ability effects.
// WHY:   config.js has had SKILL_TREES data sitting unused since the very
//        first layer — this is the module that actually spends it.
// WHERE: js/skill-tree.js — depends on config.js.
// WHO:   Assistant-A (prerequisite/cost correctness — can never allocate a
//        node you can't afford or haven't unlocked the prerequisite for).
//        Assistant-B (does the progression pacing feel meaningful?).
// ============================================================================

defineModule('skill-tree.js', {
  what: 'Skill point allocation into SKILL_TREES with prerequisite gating',
  how: 'allocateSkillPoint() validates cost+prereq against saveData, getSkillTreeEffects() sums active nodes',
  when: 'Allocation on player tap; effects summed once per physics.js frame',
  why: 'SKILL_TREES data has existed since Layer 1 with nothing to spend points into it — this closes that',
  where: 'js/skill-tree.js — depends on config.js',
  who: 'Assistant-A (prerequisite/cost correctness), Assistant-B (progression pacing)',
  exports: ['allocateSkillPoint', 'isNodeAllocated', 'isNodeAvailable', 'getSkillTreeEffects'],
  dependsOn: ['contract.js', 'config.js']
});

/**
 * @param {object} saveData - from save.js, uses saveData.xp.skillTreeAllocations
 * @param {string} treeName - key into SKILL_TREES, e.g. 'SPEED'
 * @param {string} nodeName - key into that tree, e.g. 'node1'
 * @returns {boolean}
 */
function isNodeAllocated(saveData, treeName, nodeName) {
  const key = `${treeName}.${nodeName}`;
  return !!saveData.xp.skillTreeAllocations[key];
}

/**
 * A node is available to allocate if it isn't already allocated, and its
 * prerequisite (if any) IS allocated.
 * @param {object} saveData
 * @param {string} treeName
 * @param {string} nodeName
 * @returns {boolean}
 */
function isNodeAvailable(saveData, treeName, nodeName) {
  if (isNodeAllocated(saveData, treeName, nodeName)) return false;
  const node = SKILL_TREES[treeName][nodeName];
  if (!node.requires) return true;
  return isNodeAllocated(saveData, treeName, node.requires);
}

/**
 * Attempts to spend a skill point on a node. Fails silently (returns false)
 * if the node isn't available or the player can't afford it — callers
 * should check isNodeAvailable() first for UI graying, this is the actual
 * transactional spend.
 * @param {object} saveData
 * @param {string} treeName
 * @param {string} nodeName
 * @returns {boolean} true if the point was spent
 */
function allocateSkillPoint(saveData, treeName, nodeName) {
  const node = SKILL_TREES[treeName][nodeName];
  if (!node) return false;
  if (!isNodeAvailable(saveData, treeName, nodeName)) return false;
  if (saveData.xp.skillPointsAvailable < node.cost) return false;

  saveData.xp.skillPointsAvailable -= node.cost;
  saveData.xp.skillTreeAllocations[`${treeName}.${nodeName}`] = true;
  return true;
}

/**
 * Sums every allocated node's effect across all 4 trees into one flat
 * object — same shape gear.js's computeActiveEffects().totals and
 * abilities.js's getActiveEffects() use, so physics.js can merge all three
 * identically.
 * @param {object} saveData
 * @returns {object} flat effect object
 */
function getSkillTreeEffects(saveData) {
  const totals = {};
  for (const [treeName, tree] of Object.entries(SKILL_TREES)) {
    for (const [nodeName, node] of Object.entries(tree)) {
      if (!isNodeAllocated(saveData, treeName, nodeName)) continue;
      for (const [key, val] of Object.entries(node.effect)) {
        totals[key] = typeof val === 'boolean' ? (totals[key] || false) || val : (totals[key] || 0) + val;
      }
    }
  }
  return totals;
}
