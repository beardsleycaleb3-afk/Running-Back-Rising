// ============================================================================
// PWA-LIFECYCLE.JS — Layer 10a
// WHAT:  Registers sw.js, listens for the browser's install prompt, and
//        exposes a promptInstall() function the UI can call from a real
//        button tap (install prompts require a user gesture).
// HOW:   navigator.serviceWorker.register('./sw.js') on boot. Captures the
//        'beforeinstallprompt' event (Chrome-specific) and stashes it until
//        the player taps an install button, since the browser only allows
//        showing that prompt once per captured event.
// WHEN:  registerServiceWorker() called once at boot, before or after
//        spriteLoader.loadAll() — order doesn't matter, they're independent.
// WHY:   This was the one gap left after Layer 9 — without this, sw.js and
//        manifest.json exist on disk but nothing ever tells the browser
//        about them, so nothing would actually install/cache/work offline.
// WHERE: js/pwa-lifecycle.js — no dependencies on other game modules
//        (deliberately standalone — PWA plumbing shouldn't need gear.js or
//        physics.js to function).
// WHO:   Assistant-A (registration correctness, no repeated/duplicate
//        registrations). Assistant-B (does the install prompt appear at a
//        sensible moment, not jarring mid-play?).
// ============================================================================

defineModule('pwa-lifecycle.js', {
  what: 'Service worker registration + install-prompt capture/trigger',
  how: 'navigator.serviceWorker.register() at boot, beforeinstallprompt event stashed for later',
  when: 'registerServiceWorker() once at boot; promptInstall() from a real button tap',
  why: 'sw.js + manifest.json exist but need something to actually register/invoke them',
  where: 'js/pwa-lifecycle.js — standalone, no dependency on other game modules',
  who: 'Assistant-A (registration correctness), Assistant-B (install-prompt timing/UX)',
  exports: ['registerServiceWorker', 'promptInstall', 'isInstallAvailable'],
  dependsOn: ['contract.js']
});

let deferredInstallPrompt = null;

// Captured as early as possible, at script-load time, not inside a function —
// the browser can fire this before registerServiceWorker() ever runs.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // stop the browser's default mini-infobar
  deferredInstallPrompt = event;
});

/**
 * Registers sw.js. Safe to call once at boot — no-ops gracefully (logs a
 * warning, doesn't throw) on browsers without service worker support.
 * @returns {Promise<void>}
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[pwa-lifecycle.js] Service workers not supported in this browser — PWA install/offline unavailable.');
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    console.log('%c[pwa-lifecycle.js] Service worker registered.', 'color:#4f4;', registration.scope);
  } catch (err) {
    console.warn('[pwa-lifecycle.js] Service worker registration failed:', err);
  }
}

/**
 * @returns {boolean} true if an install prompt is currently available to show
 */
function isInstallAvailable() {
  return deferredInstallPrompt !== null;
}

/**
 * Shows the captured install prompt. MUST be called from within a real user
 * gesture handler (a tap), or the browser will silently ignore it.
 * @returns {Promise<string|null>} the user's choice ('accepted'/'dismissed'), or null if no prompt was available
 */
async function promptInstall() {
  if (!deferredInstallPrompt) return null;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null; // each captured event can only be used once
  return outcome;
}
