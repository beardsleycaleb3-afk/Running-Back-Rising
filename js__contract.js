// ============================================================================
// CONTRACT.JS — Layer 1a
// WHAT:  A tiny runtime contract system. Every other module calls defineModule()
//        at the top of its file, declaring what/how/when/why/where/who + its
//        exports and dependencies.
// HOW:   Plain object registry (MODULE_CONTRACTS). No build step, no bundler —
//        this has to work by just adding <script> tags in order in index.html.
// WHEN:  Loaded FIRST, before config.js or anything else. Nothing can call
//        defineModule() until this file has run.
// WHY:   On a 3GB RAM / low-end phone, silent bugs are expensive to chase
//        (no good devtools profiling flow on a real device). A contract that
//        throws loudly at load time, in the right module, beats a mystery
//        crash three modules downstream at 2am.
// WHERE: js/contract.js — first script tag in index.html, no dependencies.
// WHO:   Assistant-A (systems) owns this file. It should almost never change
//        once written — it's infrastructure, not gameplay.
// ============================================================================

const MODULE_CONTRACTS = {};
const MODULE_LOAD_ORDER = [];

const REQUIRED_CONTRACT_KEYS = [
  'what', 'how', 'when', 'why', 'where', 'who', 'exports', 'dependsOn'
];

/**
 * Register a module's contract. Call this at the very top of every .js file,
 * before any other code in that file runs.
 *
 * @param {string} name - the filename, e.g. 'config.js'
 * @param {object} contract - { what, how, when, why, where, who, exports, dependsOn }
 * @returns {object} the same contract object (so you can chain if you want)
 */
function defineModule(name, contract) {
  for (const key of REQUIRED_CONTRACT_KEYS) {
    if (!(key in contract)) {
      throw new Error(`[CONTRACT FAIL] "${name}" is missing required field "${key}". ` +
        `Every module must answer: what, how, when, why, where, who, plus list exports/dependsOn.`);
    }
  }
  if (!Array.isArray(contract.exports) || !Array.isArray(contract.dependsOn)) {
    throw new Error(`[CONTRACT FAIL] "${name}": "exports" and "dependsOn" must be arrays.`);
  }
  if (MODULE_CONTRACTS[name]) {
    throw new Error(`[CONTRACT FAIL] "${name}" is defined twice. Check your <script> tags.`);
  }

  MODULE_CONTRACTS[name] = contract;
  MODULE_LOAD_ORDER.push(name);
  return contract;
}

/**
 * Call this ONCE, at the bottom of index.html, after every script tag has
 * loaded. Verifies that every declared dependency actually got loaded, and
 * that it was loaded BEFORE the module that depends on it (script order bugs
 * are the #1 cause of "X is not defined" errors in a no-bundler setup).
 */
function verifyAllContracts() {
  const loadedSoFar = new Set();

  for (const name of MODULE_LOAD_ORDER) {
    const contract = MODULE_CONTRACTS[name];

    for (const dep of contract.dependsOn) {
      if (!MODULE_CONTRACTS[dep]) {
        throw new Error(`[CONTRACT FAIL] "${name}" depends on "${dep}", but "${dep}" was ` +
          `never defined anywhere. Did you forget the <script> tag, or misspell the name?`);
      }
      if (!loadedSoFar.has(dep)) {
        throw new Error(`[CONTRACT FAIL] "${name}" depends on "${dep}", but "${dep}"'s ` +
          `<script> tag comes AFTER "${name}"'s in index.html. Fix the script order.`);
      }
    }

    loadedSoFar.add(name);
  }

  console.log(
    `%c[contract.js] All ${MODULE_LOAD_ORDER.length} module contracts verified in order: %c` +
    MODULE_LOAD_ORDER.join(' -> '),
    'color:#4f4; font-weight:bold;', 'color:#8f8;'
  );
}

// contract.js declares itself last, after its own functions exist.
defineModule('contract.js', {
  what: 'Runtime module-contract registry + dependency/order verifier',
  how: 'Plain object registry, throws synchronously on violation',
  when: 'Loaded first, before every other script tag',
  why: 'Cheap, loud failures beat silent bugs on hard-to-debug real devices',
  where: 'js/contract.js — no dependencies, everything depends on it',
  who: 'Assistant-A (systems), infrastructure — rarely changes',
  exports: ['defineModule', 'verifyAllContracts', 'MODULE_CONTRACTS'],
  dependsOn: []
});
