// ============================================================================
// LOGIC-GATES.JS — Layer 4a
// WHAT:  A tiny boolean logic-gate evaluator (AND, OR, NOT, XOR, NAND, NOR)
//        used to express gear set-bonus and skill-combo conditions as DATA
//        instead of nested if-statements scattered across gear.js.
// HOW:   Each gate is a pure function (a, b) => bool. A "condition tree" is
//        built from these gates + leaf predicates (checked against the
//        player's current equipped gear/skills).
// WHEN:  Called by gear.js every time equipment changes, to recompute which
//        set bonuses are currently active.
// WHY:   "Equip cleats tier 3 AND gloves tier 3 for a set bonus, UNLESS
//        shoulder pads are tier 1 (NAND)" reads cleanly as a gate tree
//        instead of a wall of &&/|| that's easy to get wrong.
// WHERE: js/logic-gates.js — depends on contract.js only.
// WHO:   Assistant-A owns the gate functions (they should never change).
//        Assistant-B designs which gear combos use which gates for fun,
//        readable bonuses.
// ============================================================================

defineModule('logic-gates.js', {
  what: 'Pure boolean logic-gate functions for expressing gear/skill conditions as data',
  how: 'Each gate is (a,b)=>bool; condition trees evaluated recursively by evaluateGate()',
  when: 'Called whenever equipped gear or skill state changes',
  why: 'Keeps gear-set-bonus logic declarative and readable instead of nested ifs',
  where: 'js/logic-gates.js — no dependencies besides contract.js',
  who: 'Assistant-A (gate correctness, never changes), Assistant-B (combo design)',
  exports: ['LOGIC_GATES', 'evaluateGate'],
  dependsOn: ['contract.js']
});

const LOGIC_GATES = Object.freeze({
  AND:  (a, b) => a && b,
  OR:   (a, b) => a || b,
  NOT:  (a)    => !a,
  XOR:  (a, b) => a !== b,
  NAND: (a, b) => !(a && b),
  NOR:  (a, b) => !(a || b)
});

/**
 * Recursively evaluates a condition tree against a context object.
 * A leaf node looks like: { check: 'gear.cleats.tier', op: '>=', value: 3 }
 * A gate node looks like: { gate: 'AND', children: [leaf, leaf] }
 * A NOT node looks like:  { gate: 'NOT', children: [leaf] }
 *
 * @param {object} node - a leaf or gate node
 * @param {object} context - flat lookup object, e.g. { 'gear.cleats.tier': 3, ... }
 * @returns {boolean}
 */
function evaluateGate(node, context) {
  if ('check' in node) {
    const actual = context[node.check];
    switch (node.op) {
      case '>=': return actual >= node.value;
      case '<=': return actual <= node.value;
      case '==': return actual === node.value;
      case '!=': return actual !== node.value;
      case '>':  return actual > node.value;
      case '<':  return actual < node.value;
      default: throw new Error(`[logic-gates.js] Unknown op "${node.op}"`);
    }
  }

  const gateFn = LOGIC_GATES[node.gate];
  if (!gateFn) throw new Error(`[logic-gates.js] Unknown gate "${node.gate}"`);

  const results = node.children.map(child => evaluateGate(child, context));
  return node.gate === 'NOT' ? gateFn(results[0]) : results.reduce((acc, r, i) => i === 0 ? r : gateFn(acc, r));
}
