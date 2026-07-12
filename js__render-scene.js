// ============================================================================
// RENDER-SCENE.JS — Layer 2c (Rendering Agent #1: the world)
// WHAT:  Draws the static background: sky (fixed, never scrolls), stadium/
//        skyline silhouette sitting on the horizon line, and the scrolling
//        grass field below it. This is the ONLY renderer allowed to touch
//        anything above GAME_CONFIG.HORIZON_Y.
// HOW:   Sky + stadium are drawn once per frame at fixed screen coordinates
//        (no camera movement affects them — per your spec, "static sky that
//        won't move"). Grass is the only scrolling element, via a simple
//        vertical offset that wraps.
// WHEN:  Called first, every render frame, before defenders or player —
//        it's the backmost layer in the painter's-algorithm draw order.
// WHY:   Separating "world" from "actors" means later swapping a placeholder
//        rect sky for a real stadium PNG touches only this file.
// WHERE: js/render-scene.js — depends on config.js.
// WHO:   Assistant-A (draw order / perf), Assistant-B (which backdrop art —
//        open stadium vs enclosed stadium — reads best for each career stage).
// ============================================================================

defineModule('render-scene.js', {
  what: 'Draws static sky, horizon/stadium silhouette, and scrolling grass field',
  how: 'Fixed-position sky/stadium draw + wrapping vertical scroll for grass, real sprites via spriteLoader',
  when: 'First call every render frame (backmost layer)',
  why: 'Isolates "world" rendering from "actor" rendering for easy asset swaps',
  where: 'js/render-scene.js — depends on config.js, sprite-loader.js, asset-manifest.js',
  who: 'Assistant-A (perf/draw order), Assistant-B (backdrop art selection per career stage)',
  exports: ['createSceneRenderer'],
  dependsOn: ['contract.js', 'config.js', 'asset-manifest.js', 'sprite-loader.js']
});

/**
 * @param {string} venueType - 'open_stadium' | 'enclosed_stadium' | 'high_school_field'
 * @param {object} spriteLoader - from createSpriteLoader()
 * @returns {object} scene renderer instance
 */
function createSceneRenderer(venueType = 'high_school_field', spriteLoader) {
  return {
    venueType,
    spriteLoader,
    grassScrollY: 0,
    backdropIndex: 0, // which of the 8 backdrop images to use for this venue

    setVenue(venueType) { this.venueType = venueType; },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} dtSeconds - for scrolling the grass texture
     */
    update(dtSeconds) {
      // Grass scrolls to sell forward motion; wraps every 64px "tile"
      const scrollSpeed = 90; // px/sec, tuned to feel matched to player speed
      this.grassScrollY = (this.grassScrollY + scrollSpeed * dtSeconds) % 64;
    },

    render(ctx) {
      const W = GAME_CONFIG.GAME_WIDTH;
      const H = GAME_CONFIG.GAME_HEIGHT;
      const horizonY = GAME_CONFIG.GAME_HEIGHT * GAME_CONFIG.HORIZON_Y_RATIO;

      // --- SKY: static, never scrolls, never affected by camera/player ---
      const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGradient.addColorStop(0, '#1e3a5f');
      skyGradient.addColorStop(1, '#4a7fa8');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, W, horizonY);

      // --- BACKDROP: real photo from assets/backdrops/{n}.jpeg, drawn behind
      // the horizon line. Falls back to nothing extra if missing (sky gradient
      // alone still reads fine).
      const backdropEntry = ASSET_MANIFEST.scene.backdrop;
      const backdropPath = backdropEntry.path.replace('{n}', this.backdropIndex + 1);
      const backdropImg = this.spriteLoader.getImage(backdropPath);
      if (backdropImg) {
        ctx.drawImage(backdropImg, 0, 0, W, horizonY);
      }

      // --- STADIUM/SKYLINE SILHOUETTE: real art if uploaded, else drawn shape ---
      const stadiumKey = this.venueType === 'enclosed_stadium' ? 'stadiumEnclosed'
        : this.venueType === 'open_stadium' ? 'stadiumOpen' : 'hsFieldBleachers';
      const stadiumEntry = ASSET_MANIFEST.scene[stadiumKey];
      const stadiumImg = this.spriteLoader.getImage(stadiumEntry.path);

      if (stadiumImg) {
        ctx.drawImage(stadiumImg, 0, horizonY - 60, W, 60);
      } else {
        // Silhouette fallback: simple jagged shape until real art is uploaded
        ctx.fillStyle = 'rgba(20,20,30,0.85)';
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        const towerCount = this.venueType === 'high_school_field' ? 3 : 7;
        const towerWidth = W / towerCount;
        for (let i = 0; i <= towerCount; i++) {
          const x = i * towerWidth;
          const towerHeight = this.venueType === 'enclosed_stadium'
            ? 40 + (i % 2) * 10
            : 22 + (i % 3) * 8;
          ctx.lineTo(x, horizonY - towerHeight);
          ctx.lineTo(x + towerWidth * 0.5, horizonY - towerHeight);
        }
        ctx.lineTo(W, horizonY);
        ctx.closePath();
        ctx.fill();
      }

      // --- GRASS FIELD: real tiles from assets/grass/grass{n}.png, tiled + scrolled ---
      const grassEntry = ASSET_MANIFEST.scene.grass;
      const tileSize = 64;
      for (let y = horizonY + (this.grassScrollY % tileSize) - tileSize; y < H; y += tileSize) {
        for (let x = 0; x < W; x += tileSize) {
          const tileIndex = Math.floor((x / tileSize) + Math.floor(y / tileSize)) % grassEntry.frames;
          const tilePath = grassEntry.path.replace('{n}', tileIndex);
          const tileImg = this.spriteLoader.getImage(tilePath);
          if (tileImg) {
            ctx.drawImage(tileImg, x, y, tileSize, tileSize);
          } else {
            ctx.fillStyle = '#2d5a2d';
            ctx.fillRect(x, y, tileSize, tileSize);
          }
        }
      }

      // Yardline-style stripes on top of grass tiles, scrolling to sell motion
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let y = horizonY + this.grassScrollY - 64; y < H; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }
  };
}
