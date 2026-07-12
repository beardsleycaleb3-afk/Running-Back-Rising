// ============================================================================
// SPRITE-LOADER.JS — Layer 3b
// WHAT:  Loads every image in ASSET_MANIFEST. If a file 404s (not uploaded
//        yet), it does NOT throw — it registers a drawn silhouette as the
//        fallback for that key. This is what lets you build the whole game
//        today and drop in real art next week without touching code.
// HOW:   For each manifest entry, tries Image().src = path. On load -> cache
//        real bitmap. On error -> cache a flag + silhouette color, and
//        getSprite() returns a tiny drawSilhouette() helper instead.
// WHEN:  boot.js calls loadAllAssets() once at startup; game does not start
//        rendering until this promise resolves (or times out safely).
// WHY:   "if I get a list of needed assets you can just code it with
//        silhouette and I'll upload and name the file whatever you decide" —
//        this file is the literal mechanism that makes that true.
// WHERE: js/sprite-loader.js — depends on asset-manifest.js, config.js.
// WHO:   Assistant-A (loader correctness/perf — no blocking on missing files).
//        Assistant-B (do the silhouette fallback shapes/colors still look
//        intentional rather than "broken"?).
// ============================================================================

defineModule('sprite-loader.js', {
  what: 'Loads manifest assets; missing files silently fall back to drawn silhouettes',
  how: 'Image() per path, resolves always (success or graceful silhouette flag)',
  when: 'Called once at boot, before render loop starts',
  why: 'Lets the whole game be built and playable before any final art exists',
  where: 'js/sprite-loader.js — depends on asset-manifest.js, config.js',
  who: 'Assistant-A (loader correctness), Assistant-B (silhouette visual quality)',
  exports: ['createSpriteLoader'],
  dependsOn: ['contract.js', 'config.js', 'asset-manifest.js']
});

// Silhouette color per category — keeps placeholders visually distinct
// and intentional-looking rather than "error gray."
const SILHOUETTE_COLORS = Object.freeze({
  player: '#9aa0a6',
  defenders: '#5a5a5a',
  scene: '#2f4f2f',
  items: '#c9a227',
  powerups: '#8e44ad',
  ui: '#444444',
  default: '#777777'
});

/**
 * Expands a manifest entry into concrete paths (handles {n} frame patterns).
 * @param {object} entry - one ASSET_MANIFEST leaf
 * @returns {string[]} list of concrete paths
 */
function expandPaths(entry) {
  if (!entry.frames) return [entry.path];
  const paths = [];
  const start = entry.zeroIndexed ? 0 : 1;
  const end = entry.zeroIndexed ? entry.frames - 1 : entry.frames;
  for (let i = start; i <= end; i++) {
    paths.push(entry.path.replace('{n}', i));
  }
  return paths;
}

/**
 * Loads a single image, never rejects — resolves with { ok, img, path }.
 * @param {string} path
 * @returns {Promise<{ok:boolean, img:HTMLImageElement|null, path:string}>}
 */
function loadOneImage(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, img, path });
    img.onerror = () => resolve({ ok: false, img: null, path });
    img.src = path;
  });
}

function createSpriteLoader() {
  const cache = new Map();   // path -> HTMLImageElement (only for ok:true)
  const missing = new Set(); // paths that 404'd, for the dev-facing report

  return {
    cache, missing,

    /**
     * Walks the entire ASSET_MANIFEST, loads everything, never throws.
     * @returns {Promise<{loaded:number, missing:number}>}
     */
    async loadAll() {
      const jobs = [];
      for (const category of Object.values(ASSET_MANIFEST)) {
        for (const entry of Object.values(category)) {
          for (const path of expandPaths(entry)) {
            jobs.push(loadOneImage(path));
          }
        }
      }

      const results = await Promise.all(jobs);
      let loadedCount = 0;
      for (const r of results) {
        if (r.ok) { cache.set(r.path, r.img); loadedCount++; }
        else { missing.add(r.path); }
      }

      if (missing.size > 0) {
        console.warn(
          `%c[sprite-loader.js] ${missing.size} asset(s) not found — using silhouettes. ` +
          `Drop the real files at these exact paths whenever you're ready:`,
          'color:#e8a33d;'
        );
        console.warn([...missing].join('\n'));
      }
      console.log(`%c[sprite-loader.js] ${loadedCount} real asset(s) loaded.`, 'color:#4f4;');

      return { loaded: loadedCount, missing: missing.size };
    },

    /**
     * @param {string} path - a concrete path (already {n}-expanded)
     * @returns {HTMLImageElement|null} real image, or null if missing
     */
    getImage(path) {
      return cache.get(path) || null;
    },

    /** @param {string} path */
    isMissing(path) {
      return missing.has(path);
    },

    /**
     * Draws either the real sprite or a silhouette fallback at the given
     * screen rect. This is the ONE function every renderer should call
     * instead of ctx.drawImage directly — it makes missing art invisible
     * as a problem and just shows as "in progress" art instead.
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} path
     * @param {string} category - key into SILHOUETTE_COLORS
     * @param {number} x centerX
     * @param {number} y centerY
     * @param {number} w
     * @param {number} h
     */
    drawSprite(ctx, path, category, x, y, w, h) {
      const img = this.getImage(path);
      if (img) {
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
        return;
      }
      // Silhouette fallback: soft rounded rect, distinct per category color
      ctx.save();
      ctx.fillStyle = SILHOUETTE_COLORS[category] || SILHOUETTE_COLORS.default;
      ctx.globalAlpha = 0.85;
      const r = Math.min(w, h) * 0.15;
      roundRectPath(ctx, x - w / 2, y - h / 2, w, h, r);
      ctx.fill();
      ctx.restore();
    }
  };
}

/** Small helper: draws a rounded-rect path (no native roundRect on old Chrome/G25). */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
