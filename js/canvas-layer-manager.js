// ============================================================================
// CANVAS-LAYER-MANAGER.JS — Layer 4g
// WHAT:  Gives each rendering agent (scene, defenders, player, fx/particles)
//        its OWN offscreen canvas. A dirty-flag queue tracks which layers
//        actually changed this frame; only those get redrawn to their
//        offscreen buffer. Every frame, all layers are composited (cheap
//        canvas-to-canvas drawImage blits) onto the one visible canvas, in
//        back-to-front z-order.
// HOW:   Map<layerName, {canvas, ctx, drawFn, dirty:bool}>. markDirty(name)
//        pushes to a FIFO queue; processDirtyQueue() dequeues and calls each
//        layer's drawFn exactly once per frame max (dedup — marking a layer
//        dirty twice in one frame still only redraws it once).
// WHEN:  markDirty() called by whichever system changed that layer's data
//        (e.g. defenders.js marks 'defenders' dirty when the pool mutates).
//        processDirtyQueue() + compositeAll() called once per render frame
//        from render-core.js's main loop.
// WHY:   Static-ish layers (sky/stadium silhouette) almost never need to
//        redraw — only the venue changing marks them dirty. Redrawing a
//        full gradient + silhouette every single frame on a Helio G25 is
//        wasted GPU time; this makes "only redraw what changed" an explicit,
//        provable guarantee instead of a hope.
// WHERE: js/canvas-layer-manager.js — depends on config.js.
// WHO:   Assistant-A (queue correctness, no duplicate redraws, no memory
//        leaks from stale offscreen canvases). Assistant-B (does compositing
//        order ever cause a visible pop/flicker?).
// ============================================================================

defineModule('canvas-layer-manager.js', {
  what: 'Per-agent offscreen canvases + dirty-flag queue/dequeue + frame compositor',
  how: 'Map of named layers, FIFO dirty queue deduped by Set, drawImage compositing',
  when: 'markDirty() from data-owning systems; process+composite once per render frame',
  why: 'Only redraw layers whose underlying data actually changed this frame',
  where: 'js/canvas-layer-manager.js — depends on config.js',
  who: 'Assistant-A (queue/perf correctness), Assistant-B (compositing visual correctness)',
  exports: ['createLayerManager'],
  dependsOn: ['contract.js', 'config.js']
});

/**
 * @returns {object} a layer manager instance
 */
function createLayerManager() {
  const layers = new Map();
  const dirtyQueue = [];
  const queuedSet = new Set();

  let mainCanvas = null;
  let mainCssWidth = GAME_CONFIG.GAME_WIDTH;
  let mainCssHeight = GAME_CONFIG.GAME_HEIGHT;
  let mainDpr = 1;

  function getDpr() {
    return Math.min(window.devicePixelRatio || 1, GAME_CONFIG.DPR_CAP);
  }

  function resizeCanvasToCss(canvas, ctx, cssWidth, cssHeight, dpr) {
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resizeAllLayers(cssWidth, cssHeight, dpr) {
    for (const layer of layers.values()) {
      resizeCanvasToCss(layer.canvas, layer.ctx, cssWidth, cssHeight, dpr);
      layer.needsFullRedraw = true;
    }
    if (mainCanvas && mainCanvas.ctx) {
      resizeCanvasToCss(mainCanvas.canvas, mainCanvas.ctx, cssWidth, cssHeight, dpr);
    }
  }

  return {
    /**
     * Registers a new rendering layer with its own offscreen canvas.
     * @param {string} name
     * @param {number} zIndex
     * @param {function} drawFn
     */
    createLayer(name, zIndex, drawFn) {
      if (layers.has(name)) {
        throw new Error(`[canvas-layer-manager.js] Layer "${name}" already exists.`);
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      layers.set(name, {
        canvas,
        ctx,
        drawFn,
        zIndex,
        needsFullRedraw: true
      });

      resizeCanvasToCss(canvas, ctx, mainCssWidth, mainCssHeight, mainDpr);
      this.markDirty(name);
    },

    /**
     * Binds the visible canvas size to the manager so compositing and
     * offscreen buffers stay in sync with the real viewport size.
     * @param {HTMLCanvasElement} canvas
     * @param {number} cssWidth
     * @param {number} cssHeight
     */
    bindMainCanvas(canvas, cssWidth, cssHeight) {
      mainCanvas = {
        canvas,
        ctx: canvas.getContext('2d')
      };
      mainCssWidth = cssWidth;
      mainCssHeight = cssHeight;
      mainDpr = getDpr();
      resizeAllLayers(mainCssWidth, mainCssHeight, mainDpr);
    },

    /**
     * Resizes every layer and the main canvas to a new viewport size.
     * @param {number} cssWidth
     * @param {number} cssHeight
     */
    resize(cssWidth, cssHeight) {
      mainCssWidth = cssWidth;
      mainCssHeight = cssHeight;
      mainDpr = getDpr();
      resizeAllLayers(mainCssWidth, mainCssHeight, mainDpr);
      for (const name of layers.keys()) this.markDirty(name);
    },

    /**
     * Marks a layer as needing redraw this frame.
     * @param {string} name
     */
    markDirty(name) {
      if (!layers.has(name)) {
        throw new Error(`[canvas-layer-manager.js] Cannot mark unknown layer "${name}" dirty.`);
      }
      if (!queuedSet.has(name)) {
        dirtyQueue.push(name);
        queuedSet.add(name);
      }
    },

    /**
     * Dequeues every currently-dirty layer and redraws it into its own
     * offscreen canvas. Call once per frame, before compositeAll().
     */
    processDirtyQueue() {
      while (dirtyQueue.length > 0) {
        const name = dirtyQueue.shift();
        queuedSet.delete(name);
        const layer = layers.get(name);
        if (!layer) continue;
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.drawFn(layer.ctx);
        layer.needsFullRedraw = false;
      }
    },

    /**
     * Blits every layer's offscreen canvas onto the visible canvas, in
     * zIndex order.
     * @param {CanvasRenderingContext2D} mainCtx
     */
    compositeAll(mainCtx) {
      const ordered = [...layers.values()].sort((a, b) => a.zIndex - b.zIndex);
      mainCtx.setTransform(mainDpr, 0, 0, mainDpr, 0, 0);
      mainCtx.clearRect(0, 0, mainCssWidth, mainCssHeight);
      for (const layer of ordered) {
        mainCtx.drawImage(layer.canvas, 0, 0, mainCssWidth, mainCssHeight);
      }
    },

    /**
     * Removes a layer entirely.
     * @param {string} name
     */
    unloadLayer(name) {
      layers.delete(name);
      queuedSet.delete(name);
      const idx = dirtyQueue.indexOf(name);
      if (idx !== -1) dirtyQueue.splice(idx, 1);
    }
  };
}
