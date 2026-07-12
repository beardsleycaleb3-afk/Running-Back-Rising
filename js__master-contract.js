// ============================================================================
// MASTER-CONTRACT.JS — Layer 5b (head oversight, sits above contract.js)
// WHAT:  Two things contract.js doesn't cover on its own:
//        1) A CANONICAL_LOAD_ORDER — the intended script order, maintained
//           by hand as a plain array. Drift between "what index.html
//           actually loaded" (contract.js's MODULE_LOAD_ORDER) and "what
//           SHOULD have loaded, in what order" gets caught here.
//        2) registerNonModular() — a lighter-weight registry for things that
//           aren't a .js file at all: the inline bootstrap <script> block in
//           index.html, the CSS HUD frame, the manifest/checklist docs. They
//           don't need the full what/how/when/why/where/who contract, but
//           they still get logged so a full-project audit sees EVERYTHING,
//           not just the .js files.
// HOW:   Plain arrays/objects, one audit function that prints a full report.
// WHEN:  Loaded after all other .js modules, before the inline bootstrap
//        script runs. The inline script calls registerNonModular() for
//        itself, then runMasterAudit() as the very last thing before
//        starting the game — so if ANYTHING in the whole load chain (JS or
//        not) is out of order or missing, you see it before gameplay starts.
// WHY:   "Master contract head contract oversight... helpers to help with
//        the order of non modular stuff too" — this file IS that oversight
//        layer, sitting one level above contract.js rather than replacing it.
// WHERE: js/master-contract.js — depends on contract.js only (loaded right
//        after it conceptually, but physically loaded LAST since it needs
//        every other module's contract already registered to audit them).
// WHO:   Assistant-A owns this file exclusively — it's pure oversight
//        tooling, no gameplay-facing exports.
// ============================================================================

defineModule('master-contract.js', {
  what: 'Head oversight above contract.js: canonical load-order + non-modular registry + full audit',
  how: 'Plain arrays/objects, one runMasterAudit() that reports drift and missing pieces',
  when: 'Loaded last among .js files; audit runs after inline bootstrap self-registers',
  why: 'Extends contract coverage to non-.js pieces (inline scripts, CSS/HTML chrome)',
  where: 'js/master-contract.js — depends on contract.js, loaded after every other module',
  who: 'Assistant-A (pure oversight tooling, no gameplay exports)',
  exports: ['CANONICAL_LOAD_ORDER', 'registerNonModular', 'runMasterAudit'],
  dependsOn: ['contract.js']
});

// The intended order. Update this by hand any time a new script tag is
// added to index.html — runMasterAudit() will flag any mismatch against
// contract.js's MODULE_LOAD_ORDER (which reflects what ACTUALLY loaded).
const CANONICAL_LOAD_ORDER = Object.freeze([
  'contract.js', 'config.js', 'clock.js', 'game-state.js',
  'career-progression.js', 'story.js',
  'asset-manifest.js', 'sprite-loader.js', 'ui-backdrops.js',
  'logic-gates.js', 'trie.js', 'gear.js', 'unlockables.js', 'rewards.js', 'save.js',
  'smart-play.js', 'overlay-ui.js', 'abilities.js', 'collision-resolution.js',
  'spawner.js', 'physics.js',
  'canvas-layer-manager.js',
  'render-core.js', 'render-scene.js', 'render-defenders.js', 'render-player.js',
  'master-contract.js'
]);

const NON_MODULAR_REGISTRY = [];

/**
 * Registers a non-.js piece of the project (inline script, CSS block, doc
 * file) so it shows up in the full project audit even though it never
 * calls defineModule() itself.
 * @param {string} name - e.g. 'index.html:inline-boot'
 * @param {{what:string, where:string}} info - lightweight, not the full contract
 */
function registerNonModular(name, info) {
  if (!info || !info.what || !info.where) {
    throw new Error(`[master-contract.js] registerNonModular("${name}") needs at least {what, where}.`);
  }
  NON_MODULAR_REGISTRY.push({ name, ...info });
}

/**
 * Full project audit: verifies every .js module's dependency order (via
 * contract.js), checks the actual load order against CANONICAL_LOAD_ORDER,
 * and lists every registered non-modular piece. Call once, after the inline
 * bootstrap script has finished calling registerNonModular() for itself.
 */
function runMasterAudit() {
  verifyAllContracts(); // re-run the base dependency-order check first

  const actual = MODULE_LOAD_ORDER;
  const mismatches = [];
  for (let i = 0; i < Math.max(actual.length, CANONICAL_LOAD_ORDER.length); i++) {
    if (actual[i] !== CANONICAL_LOAD_ORDER[i]) {
      mismatches.push(`  position ${i}: expected "${CANONICAL_LOAD_ORDER[i] || '(nothing)'}", got "${actual[i] || '(nothing)'}"`);
    }
  }

  if (mismatches.length > 0) {
    console.warn('%c[master-contract.js] Load order DRIFT detected vs CANONICAL_LOAD_ORDER:', 'color:#e8a33d;');
    console.warn(mismatches.join('\n'));
  } else {
    console.log('%c[master-contract.js] Load order matches canonical order exactly ✓', 'color:#4f4;');
  }

  console.log(`%c[master-contract.js] ${NON_MODULAR_REGISTRY.length} non-modular piece(s) registered:`, 'color:#8cf;');
  for (const entry of NON_MODULAR_REGISTRY) {
    console.log(`  • ${entry.name} — ${entry.what} (${entry.where})`);
  }

  console.log(`%c[master-contract.js] FULL AUDIT COMPLETE: ${actual.length} JS module(s) + ${NON_MODULAR_REGISTRY.length} non-modular piece(s).`, 'color:#4f4; font-weight:bold;');
}
