// ============================================================================
// RENDER-DEFENDERS.JS — Layer 2d (Rendering Agent #2: defenders)
// WHAT:  Draws every active defender entity, sorted back-to-front by their
//        z (depth) value using the painter's algorithm.
// HOW:   Takes an array of defender entities (pooled, fixed max length —
//        see GAME_CONFIG.MAX_ONSCREEN_DEFENDERS) and blits a placeholder
//        shape per defender, scaled/positioned via the shared projection
//        math in render-core.js.
// WHEN:  Called second, every render frame, after render-scene.js and
//        before render-player.js (defenders sit behind the player only when
//        their z says they're farther away — sort handles that).
// WHY:   Isolating "draw the defenders" from "simulate the defenders"
//        (which will live in entities/defenders.js later) means this file
//        never needs to know about AI/collision — only how to draw a given
//        state snapshot. Easy to profile/replace independently.
// WHERE: js/render-defenders.js — depends on config.js, render-core.js
//        (for the shared projectZ/laneToX helpers).
// WHO:   Assistant-A (perf: object pooling, draw call count).
//        Assistant-B (readability: can the player tell defender types apart
//        at a glance? are the tackle-imminent ones visually distinct?).
// ============================================================================

defineModule('render-defenders.js', {
  what: 'Draws all active defender entities, sorted back-to-front by depth',
  how: 'Iterates a fixed-capacity pooled array, projects each via shared projection math',
  when: 'Second render call each frame, after scene, before player',
  why: 'Separates "draw defenders" from "simulate defenders" for independent iteration',
  where: 'js/render-defenders.js — depends on config.js, render-core.js, asset-manifest.js, sprite-loader.js, career-progression.js',
  who: 'Assistant-A (perf/pooling), Assistant-B (visual readability of defender types)',
  exports: ['createDefenderRenderer'],
  dependsOn: ['contract.js', 'config.js', 'render-core.js', 'asset-manifest.js', 'sprite-loader.js', 'career-progression.js']
});

/**
 * @param {object} spriteLoader - from createSpriteLoader()
 */
function createDefenderRenderer(spriteLoader) {
  return {
    spriteLoader,

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array<object>} defenders - active defender entities:
     *   { lane, z: 0..1, teamKey: string (e.g. 'GRANITE_BEARS' or 'GENERIC'),
     *     frame: number, isTackling: bool, active: bool }
     * @param {object} projection - shared helpers from render-core.js
     */
    render(ctx, defenders, projection) {
      // Painter's algorithm: farthest (largest z) drawn first
      const active = defenders.filter(d => d.active);
      active.sort((a, b) => b.z - a.z);

      for (const d of active) {
        const { scale, screenY } = projection.projectZ(d.z);
        const screenX = projection.laneToX(d.lane, d.z);
        const size = 40 * scale;

        // Art comes from the TEAM you're facing this run (or GENERIC for
        // HS/college/Pro Bowl/HOF runs with no named opponent) — never from
        // a position archetype. See career-progression.js:getDefenderTeamKey().
        const entry = ASSET_MANIFEST.defenders[d.teamKey] || ASSET_MANIFEST.defenders.GENERIC;
        const frameIndex = (d.frame || 0) + 1; // manifest frames are 1-indexed
        const path = entry.path.replace('{n}', frameIndex);

        this.spriteLoader.drawSprite(ctx, path, 'defenders', screenX, screenY, size, size);

        // Tackle-imminent visual flag — a hard readability requirement,
        // not cosmetic: the player needs a reaction window. Drawn on top
        // of either the real sprite or the silhouette, always.
        if (d.isTackling) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,0,0,0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(screenX, screenY, size * 0.65, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };
}
