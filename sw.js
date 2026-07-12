// ============================================================================
// SW.JS — Service Worker
// WHAT:  Caches the full app shell (every JS module + every real asset on
//        disk, in the exact same list generated from index.html's own
//        script tags and the assets/ folder — see the generation script
//        this came from) so the PWA installs and launches offline.
// HOW:   Cache-first for everything in CACHE_ASSETS (app shell + assets),
//        network-first fallback for anything not in the list (so new
//        assets you add later still load even before the next SW update).
// WHEN:  install event precaches everything below. activate event purges
//        any OLD cache version. fetch event serves from cache first.
// WHY:   This list is generated, not hand-typed, specifically so it can
//        never drift out of naming-sync with manifest.json or the real
//        files on disk — the exact failure mode you flagged as a risk.
// WHERE: /sw.js — registered from js/pwa-lifecycle.js.
// ============================================================================

const CACHE_VERSION = 'rbr-v1';

const CACHE_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./",
  "./js/abilities.js",
  "./js/ai-coach.js",
  "./js/asset-manifest.js",
  "./js/audio.js",
  "./js/canvas-layer-manager.js",
  "./js/career-progression.js",
  "./js/clock.js",
  "./js/collision-resolution.js",
  "./js/config.js",
  "./js/contract.js",
  "./js/game-state.js",
  "./js/gear.js",
  "./js/logic-gates.js",
  "./js/master-contract.js",
  "./js/menus.js",
  "./js/overlay-ui.js",
  "./js/physics.js",
  "./js/render-core.js",
  "./js/render-defenders.js",
  "./js/render-player.js",
  "./js/render-scene.js",
  "./js/rewards.js",
  "./js/save.js",
  "./js/skill-tree.js",
  "./js/smart-play.js",
  "./js/spawner.js",
  "./js/sprite-loader.js",
  "./js/story.js",
  "./js/trie.js",
  "./js/ui-backdrops.js",
  "./js/unlockables.js",
  "./assets/backdrops/1.jpeg",
  "./assets/backdrops/2.jpeg",
  "./assets/backdrops/3.jpeg",
  "./assets/backdrops/4.jpeg",
  "./assets/backdrops/5.jpeg",
  "./assets/backdrops/6.jpeg",
  "./assets/backdrops/7.jpeg",
  "./assets/backdrops/8.jpeg",
  "./assets/endzones/endzone0.png",
  "./assets/endzones/endzone1.png",
  "./assets/endzones/endzone2.png",
  "./assets/endzones/endzone3.png",
  "./assets/endzones/endzone4.png",
  "./assets/endzones/endzone5.png",
  "./assets/endzones/endzone6.png",
  "./assets/endzones/endzone7.png",
  "./assets/grass/grass0.png",
  "./assets/grass/grass1.png",
  "./assets/grass/grass2.png",
  "./assets/grass/grass3.png",
  "./assets/grass/grass4.png",
  "./assets/grass/grass5.png",
  "./assets/grass/grass6.png",
  "./assets/grass/grass7.png",
  "./assets/grass/grass8.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-512.png",
  "./assets/sprites/items/sheet.png",
  "./assets/sprites/powerups/sheet.png",
  "./assets/ui/gear/cleats_tier1.svg",
  "./assets/ui/gear/cleats_tier2.svg",
  "./assets/ui/gear/cleats_tier3.svg",
  "./assets/ui/gear/cleats_tier4.svg",
  "./assets/ui/gear/elbowpads_tier1.svg",
  "./assets/ui/gear/elbowpads_tier2.svg",
  "./assets/ui/gear/elbowpads_tier3.svg",
  "./assets/ui/gear/elbowpads_tier4.svg",
  "./assets/ui/gear/gloves_tier1.svg",
  "./assets/ui/gear/gloves_tier2.svg",
  "./assets/ui/gear/gloves_tier3.svg",
  "./assets/ui/gear/gloves_tier4.svg",
  "./assets/ui/gear/shoulderpads_tier1.svg",
  "./assets/ui/gear/shoulderpads_tier2.svg",
  "./assets/ui/gear/shoulderpads_tier3.svg",
  "./assets/ui/gear/shoulderpads_tier4.svg",
  "./assets/ui/icons/ability_ghost.svg",
  "./assets/ui/icons/ability_power.svg",
  "./assets/ui/icons/ability_speed.svg",
  "./assets/ui/icons/ability_tank.svg",
  "./assets/ui/icons/ability_tricky.svg",
  "./assets/ui/icons/ability_turbo.svg",
  "./assets/ui/icons/btn_juke_left.svg",
  "./assets/ui/icons/btn_juke_right.svg",
  "./assets/ui/icons/btn_sprint.svg",
  "./assets/ui/icons/btn_stiff_arm.svg",
  "./assets/ui/icons/coach_portrait.svg",
  "./assets/ui/skilltree/node_hands.svg",
  "./assets/ui/skilltree/node_power.svg",
  "./assets/ui/skilltree/node_speed.svg",
  "./assets/ui/skilltree/node_vision.svg",
  "./assets/sprites/defenders/bears/1.png",
  "./assets/sprites/defenders/bears/2.png",
  "./assets/sprites/defenders/bears/3.png",
  "./assets/sprites/defenders/bears/4.png",
  "./assets/sprites/defenders/cowboys/1.png",
  "./assets/sprites/defenders/cowboys/2.png",
  "./assets/sprites/defenders/cowboys/3.png",
  "./assets/sprites/defenders/cowboys/4.png",
  "./assets/sprites/defenders/generic/1.png",
  "./assets/sprites/defenders/generic/2.png",
  "./assets/sprites/defenders/miners/1.png",
  "./assets/sprites/defenders/miners/2.png",
  "./assets/sprites/defenders/miners/3.png",
  "./assets/sprites/defenders/panthers/1.png",
  "./assets/sprites/defenders/panthers/2.png",
  "./assets/sprites/defenders/vikings/1.png",
  "./assets/sprites/defenders/vikings/2.png",
  "./assets/sprites/defenders/vikings/3.png",
  "./assets/sprites/defenders/vikings/4.png",
  "./assets/sprites/player/running/1.png"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
