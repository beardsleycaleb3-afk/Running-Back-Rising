// ============================================================================
// MENUS.JS — Layer 9d
// WHAT:  The two screens that were missing: the MAIN MENU (shown at boot,
//        before the career starts) and the CAREER COMPLETE screen (shown
//        once, after Run 12, playing the Hall of Fame induction epilogue).
// HOW:   Canvas-drawn, same pattern as overlay-ui.js — own render function,
//        own tap hit-testing, uses ui-backdrops.js for the background photo.
// WHEN:  render-core.js draws the main menu while state is MENU (before the
//        player has tapped "Start Career"), and the career-complete screen
//        once when chapterIndex reaches 11 (Hall of Fame Game) AND that run
//        ends — regardless of tackle/TD, finishing Run 12 ends the career.
// WHY:   There was no way to actually START the game deliberately before —
//        render-core.js just force-transitioned straight to PLAYING on
//        boot. Now there's a real front door and a real ending.
// WHERE: js/menus.js — depends on config.js, ui-backdrops.js, sprite-loader.js, story.js.
// WHO:   Assistant-A (screen/tap correctness). Assistant-B (does the framing
//        text on each screen actually land emotionally?).
// ============================================================================

defineModule('menus.js', {
  what: 'Main menu (start screen) and career-complete (Hall of Fame induction) screens',
  how: 'Canvas-drawn, own render + tap hit-testing, backed by ui-backdrops.js photos',
  when: 'Main menu shown at boot before PLAYING starts; career-complete shown once after Run 12',
  why: 'There was no deliberate start screen or ending before — game just force-started',
  where: 'js/menus.js — depends on config.js, ui-backdrops.js, sprite-loader.js, story.js',
  who: 'Assistant-A (screen/tap correctness), Assistant-B (emotional framing)',
  exports: ['createMenuScreens'],
  dependsOn: ['contract.js', 'config.js', 'ui-backdrops.js', 'sprite-loader.js', 'story.js']
});

function createMenuScreens(spriteLoader) {
  let startButtonRect = null;

  return {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} saveData - from save.js, used to show "Continue" vs "New Career"
     */
    renderMainMenu(ctx, saveData) {
      const W = GAME_CONFIG.GAME_WIDTH, H = GAME_CONFIG.GAME_HEIGHT;
      const bgPath = getUiBackdropPath('MAIN_MENU');
      const bgImg = spriteLoader.getImage(bgPath);

      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, W, H);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('RUNNING BACK', W / 2, H * 0.28);
      ctx.fillStyle = '#c9a227';
      ctx.fillText('RISING', W / 2, H * 0.28 + 34);

      const hasProgress = saveData.career.chaptersCompleted > 0;
      const label = hasProgress
        ? `Continue — Run ${saveData.career.chaptersCompleted + 1}`
        : 'Start Career';

      const btnW = 200, btnH = 46;
      const btnX = W / 2 - btnW / 2, btnY = H * 0.55;
      ctx.fillStyle = '#3f7fd6';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      roundRectPath(ctx, btnX, btnY, btnW, btnH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(label, W / 2, btnY + btnH / 2 + 5);
      startButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      if (hasProgress) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Level ${saveData.xp.level} · ${saveData.stats.totalStars} stars` +
          (saveData.career.teamKey ? ` · ${saveData.career.teamKey.replace('_', ' ')}` : ''), W / 2, btnY + btnH + 24);
      }
    },

    /**
     * @param {number} tapX
     * @param {number} tapY
     * @returns {boolean} true if the Start/Continue button was tapped
     */
    handleMainMenuTap(tapX, tapY) {
      if (!startButtonRect) return false;
      const r = startButtonRect;
      return tapX >= r.x && tapX <= r.x + r.w && tapY >= r.y && tapY <= r.y + r.h;
    },

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} saveData
     */
    renderCareerComplete(ctx, saveData) {
      const W = GAME_CONFIG.GAME_WIDTH, H = GAME_CONFIG.GAME_HEIGHT;
      const bgPath = getUiBackdropPath('CAREER_COMPLETE');
      const bgImg = spriteLoader.getImage(bgPath);

      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, W, H);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#c9a227';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('HALL OF FAME', W / 2, 70);

      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      wrapText(ctx, HOF_INDUCTION_EPILOGUE, W / 2, 110, W - 60, 16);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`Final level: ${saveData.xp.level} · ${saveData.stats.totalStars} career stars`, W / 2, H - 80);

      const btnW = 180, btnH = 40;
      const btnX = W / 2 - btnW / 2, btnY = H - 60;
      ctx.fillStyle = '#3ec93e';
      roundRectPath(ctx, btnX, btnY, btnW, btnH, 10);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('NEW CAREER', W / 2, btnY + btnH / 2 + 4);
      startButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    }
  };
}
