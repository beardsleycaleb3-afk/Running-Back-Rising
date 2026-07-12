// ============================================================================
// RENDER-PLAYER.JS — Layer 2e (Rendering Agent #3: the player/mascot)
// WHAT:  Draws the player entity — always drawn at z=0 (closest to camera),
//        so it's always in front of defenders. Colors/silhouette come from
//        TEAM_MASCOTS once drafted; pre-draft it's a neutral placeholder.
// HOW:   Single blit at a fixed screen-space anchor (bottom-center-ish),
//        only its LANE (x position) moves — z never changes for the player,
//        only the world scrolls past. This matches the classic lane-runner
//        trick and keeps player draw cost constant every frame.
// WHEN:  Called last, every render frame — always on top of scene + defenders.
// WHY:   Separating player draw from defender draw means swapping mascot
//        skins (tiger/bear/falcon/lion/...) never touches defender code,
//        and vice versa.
// WHERE: js/render-player.js — depends on config.js, render-core.js.
// WHO:   Assistant-A (anchor positioning/consistency), Assistant-B (does the
//        mascot read clearly at a glance against each venue backdrop?).
// ============================================================================

defineModule('render-player.js', {
  what: 'Draws the player/mascot entity at a fixed 128x256 size, anchored above the bottom border',
  how: 'Fixed-size blit at a screen-space anchor, only lane/x and a small run-bob animate',
  when: 'Last render call each frame (always on top)',
  why: 'Isolates mascot-skin rendering from defender rendering entirely; fixed size keeps the closest character consistently readable regardless of projection math',
  where: 'js/render-player.js — depends on config.js, render-core.js, asset-manifest.js, sprite-loader.js',
  who: 'Assistant-A (anchor consistency), Assistant-B (mascot readability vs backdrop)',
  exports: ['createPlayerRenderer'],
  dependsOn: ['contract.js', 'config.js', 'render-core.js', 'asset-manifest.js', 'sprite-loader.js']
});

/**
 * @param {object} spriteLoader - from createSpriteLoader()
 */
function createPlayerRenderer(spriteLoader) {
  return {
    spriteLoader,

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} player - { lane: -1..1 (float, mid-slide), teamKey: string|null,
     *                            hp: number, maxHp: number, runCyclePhase: number, frame: number }
     * @param {object} projection - shared helpers from render-core.js (used for X/lane only)
     */
    render(ctx, player, projection) {
      // Player is always the closest thing on screen, so it renders at a
      // FIXED size (GAME_CONFIG.PLAYER_WIDTH x PLAYER_HEIGHT) rather than
      // scaling with projectZ() like defenders do — only its lane (X) moves,
      // per the classic lane-runner trick. Anchored so its feet sit right at
      // the bottom edge of the play area, just above the CSS bottom border.
      const w = GAME_CONFIG.PLAYER_WIDTH;
      const h = GAME_CONFIG.PLAYER_HEIGHT;
      const bottomMarginPx = 6;
      const screenX = projection.laneToX(player.lane, 0); // z=0 = nearest lane spread
      const centerY = GAME_CONFIG.GAME_HEIGHT - bottomMarginPx - h / 2;

      const team = player.teamKey ? TEAM_MASCOTS[player.teamKey] : null;
      const primary = team ? team.primary : '#cccccc';
      const secondary = team ? team.secondary : '#666666';

      ctx.save();
      ctx.translate(screenX, centerY);

      // Simple run-cycle bob — small and fixed, independent of any scale now
      const bob = Math.sin(player.runCyclePhase) * 5;
      ctx.translate(0, bob);

      // Real mascot sprite if the team has one uploaded; falls back to a
      // recolored silhouette using the team's actual jersey colors so it
      // still reads as "your team" even before real art exists.
      const teamKey = player.teamKey || 'RIVERSIDE_TIGERS'; // default before draft
      const entry = ASSET_MANIFEST.player[teamKey];
      const frameIndex = (player.frame || 0) + 1;
      const path = entry ? entry.path.replace('{n}', frameIndex) : null;
      const img = path ? this.spriteLoader.getImage(path) : null;

      if (img) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        // Portrait silhouette: rounded "body" shape proportioned to w x h
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.15, w * 0.42, h * 0.38, 0, 0, Math.PI * 2); // torso/head mass
        ctx.fill();
        ctx.fillRect(-w * 0.28, h * 0.05, w * 0.56, h * 0.45); // legs block
        ctx.fillStyle = secondary;
        ctx.fillRect(-w * 0.12, -h * 0.3, w * 0.24, h * 0.5); // jersey stripe accent
      }

      ctx.restore();

      // HP bar directly above player's head, screen-space (not bobbed, stays readable)
      const barW = 46, barH = 5;
      const barX = screenX - barW / 2;
      const barY = centerY - h / 2 - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = player.hp / player.maxHp > 0.3 ? '#3ec93e' : '#e33';
      ctx.fillRect(barX, barY, barW * (player.hp / player.maxHp), barH);
    }
  };
}
