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
  const layers = new Map();       // name -> { canvas, ctx, drawFn, zIndex }
  const dirtyQueue = [];          // FIFO order of layer names to redraw this pass
  const queuedSet = new Set();    // dedup guard — a layer only queues once per frame

  return {
    /**
     * Registers a new rendering layer with its own offscreen canvas.
     * @param {string} name - unique layer id, e.g. 'scene', 'defenders', 'player'
     * @param {number} zIndex - draw order, lower drawn first (further back)
     * @param {function} drawFn - (ctx) => void, called only when layer is dirty
     */
    createLayer(name, zIndex, drawFn) {
      if (layers.has(name)) {
        throw new Error(`[canvas-layer-manager.js] Layer "${name}" already exists.`);
      }
      const canvas = document.createElement('canvas');
      canvas.width = GAME_CONFIG.GAME_WIDTH;
      canvas.height = GAME_CONFIG.GAME_HEIGHT;
      const ctx = canvas.getContext('2d');
      layers.set(name, { canvas, ctx, drawFn, zIndex });
      // New layers start dirty so they get an initial draw.
      this.markDirty(name);
    },

    /**
     * Marks a layer as needing redraw this frame. Safe to call multiple
     * times per frame — the queuedSet guard prevents duplicate work.
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
        const name = dirtyQueue.shift(); // dequeue (FIFO)
        queuedSet.delete(name);
        const layer = layers.get(name);
        if (!layer) continue; // layer removed mid-flight, skip safely
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.drawFn(layer.ctx);
      }
    },

    /**
     * Blits every layer's offscreen canvas onto the visible canvas, in
     * zIndex order. This runs every frame regardless of dirty state — the
     * expensive part (actually redrawing pixels) already happened only for
     * dirty layers in processDirtyQueue(); this is just cheap compositing.
     * @param {CanvasRenderingContext2D} mainCtx
     */
    compositeAll(mainCtx) {
      const ordered = [...layers.values()].sort((a, b) => a.zIndex - b.zIndex);
      mainCtx.clearRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
      for (const layer of ordered) {
        mainCtx.drawImage(layer.canvas, 0, 0);
      }
    },

    /**
     * Removes a layer entirely (frees its offscreen canvas for GC — the
     * "unload" half of "load and unload"). Use when a venue/scene type is
     * permanently done with for this session (rare — most layers persist).
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
