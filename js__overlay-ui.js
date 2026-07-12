// ============================================================================
// OVERLAY-UI.JS — Layer 8c
// WHAT:  The BETWEEN_PLAYS / SKILL_MENU overlay — Smart Play call selection,
//        drawn as its OWN canvas layer on top of the still-rendering scene.
//        Cards are drawn with a slight z-scale/depth treatment (the
//        currently-hovered/nearest card renders slightly larger + more
//        opaque, matching the same projection language the rest of the game
//        uses) rather than a flat static popup.
// HOW:   Registered as a 4th layer in canvas-layer-manager.js at the highest
//        zIndex, ABOVE scene/defenders/player. render-core.js marks this
//        layer dirty only while state is BETWEEN_PLAYS or SKILL_MENU, and
//        marks it for removal (fades out) when returning to PLAYING. Hit
//        testing is plain rectangle math against the last-drawn card
//        positions, done in the same coordinate space the canvas draws in.
// WHEN:  render() called whenever the layer is dirty (i.e. only during the
//        between-play pause). handleTap(x, y) called from the pointer
//        handler in index.html, forwarded only while this state is active.
// WHY:   This is the literal answer to "keep the runner running with the
//        field still rolling while you apply stuff between runs like an
//        overlay" — the scene layer never stops being told to redraw
//        (grass keeps scrolling), only physics.js stops ticking, and this
//        layer draws on top with its own depth-flavored visual treatment.
// WHERE: js/overlay-ui.js — depends on config.js, smart-play.js, sprite-loader.js
//        (reuses roundRectPath from sprite-loader.js rather than duplicating it —
//        see the audit note this replaced: a second copy of that helper used to
//        live in this file, which silently shadowed the first in the shared
//        global script scope. One copy now, sprite-loader.js owns it).
// WHO:   Assistant-A (hit-test accuracy, layer z-order correctness).
//        Assistant-B (does the depth/scale treatment read as "same game
//        language" rather than a bolted-on popup?).
// ============================================================================

defineModule('overlay-ui.js', {
  what: 'Canvas-drawn BETWEEN_PLAYS/SKILL_MENU overlay with depth-scaled Smart Play cards',
  how: 'Own layer at highest zIndex in canvas-layer-manager.js, rect-based hit testing',
  when: 'Dirty/rendered only during BETWEEN_PLAYS/SKILL_MENU; scene keeps rendering underneath',
  why: 'The field stays alive visually while physics.js is paused — overlay, not a hard cut',
  where: 'js/overlay-ui.js — depends on config.js, smart-play.js, sprite-loader.js, gear.js',
  who: 'Assistant-A (hit-test/z-order correctness), Assistant-B (depth treatment feel)',
  exports: ['createOverlayUI'],
  dependsOn: ['contract.js', 'config.js', 'smart-play.js', 'sprite-loader.js', 'gear.js']
});

/**
 * @returns {object} overlay UI instance
 */
function createOverlayUI() {
  const callIds = Object.keys(SMART_PLAY_CALLS);
  let cardRects = []; // last-drawn hit boxes, recomputed every render()
  let focusedIndex = 1; // middle card starts "nearest" for the depth treatment
  let gearRowRects = []; // hit boxes for the gear-equip screen
  const GEAR_SLOTS = ['cleats', 'shoulderPads', 'gloves', 'elbowPads'];

  return {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} smartPlayState - from smart-play.js
     * @param {number} cooldownRemainingSec - play-clock countdown, for urgency framing
     */
    render(ctx, smartPlayState, cooldownRemainingSec) {
      const W = GAME_CONFIG.GAME_WIDTH;
      const H = GAME_CONFIG.GAME_HEIGHT;

      // Dim scrim over the still-rolling field — NOT opaque, field stays visible
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SMART PLAY', W / 2, 60);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#e8a33d';
      ctx.fillText(`auto-picks in ${Math.ceil(cooldownRemainingSec)}s`, W / 2, 80);

      cardRects = [];
      const cardW = 96, cardH = 130, gap = 12;
      const totalW = cardW * 3 + gap * 2;
      const startX = W / 2 - totalW / 2;
      const centerY = H / 2 - 20; // shifted up to make room for the GEAR tab below

      callIds.forEach((id, i) => {
        const call = SMART_PLAY_CALLS[id];
        // Depth treatment: the focused (nearest) card scales up slightly and
        // sits closer to full opacity, same visual language as projectZ()
        // scaling defenders by distance — depth = focus here, not literal z.
        const isFocused = i === focusedIndex;
        const scale = isFocused ? 1.08 : 0.92;
        const alpha = isFocused ? 1.0 : 0.7;
        const w = cardW * scale, h = cardH * scale;
        const x = startX + i * (cardW + gap) + cardW / 2;
        const y = centerY;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = smartPlayState.pendingCallId === id ? '#3f7fd6' : '#1a1a1a';
        ctx.strokeStyle = isFocused ? '#e8a33d' : '#555';
        ctx.lineWidth = isFocused ? 3 : 1.5;
        roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(12 * scale)}px monospace`;
        ctx.fillText(call.label, x, y - h / 2 + 20);

        ctx.font = `${Math.round(9 * scale)}px monospace`;
        ctx.fillStyle = '#ccc';
        wrapText(ctx, call.flavor, x, y - 5, w - 14, 11);

        ctx.restore();

        cardRects.push({ id, x: x - w / 2, y: y - h / 2, w, h, index: i });
      });

      // --- GEAR tab: a fixed button below the cards, opens the equip screen ---
      const tabW = 140, tabH = 34;
      const tabX = W / 2 - tabW / 2, tabY = centerY + cardH / 2 + 30;
      ctx.fillStyle = '#2a2a2a';
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 2;
      roundRectPath(ctx, tabX, tabY, tabW, tabH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c9a227';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('⚙ MANAGE GEAR', W / 2, tabY + tabH / 2 + 4);
      cardRects.push({ id: '__OPEN_GEAR__', x: tabX, y: tabY, w: tabW, h: tabH, index: -1 });
    },

    /**
     * Renders the gear-equip screen (shown while state is SKILL_MENU).
     * Tapping a slot cycles it to the next OWNED tier for that slot; tiers
     * you don't own yet are skipped, so you can never equip something you
     * haven't earned.
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} saveData - from save.js
     */
    renderGearScreen(ctx, saveData) {
      const W = GAME_CONFIG.GAME_WIDTH, H = GAME_CONFIG.GAME_HEIGHT;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MANAGE GEAR', W / 2, 60);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Tap a slot to cycle through owned tiers', W / 2, 78);

      gearRowRects = [];
      const rowH = 60, rowW = W - 60, startY = 110;
      GEAR_SLOTS.forEach((slot, i) => {
        const y = startY + i * (rowH + 14);
        const x = 30;
        const equippedTier = saveData.gear.equipped[slot];
        const ownedTiers = saveData.gear.owned[slot];

        ctx.fillStyle = '#1a1a1a';
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, x, y, rowW, rowH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(slot, x + 14, y + 24);

        ctx.font = '10px monospace';
        ctx.fillStyle = equippedTier > 0 ? (GEAR_TIERS[equippedTier] || {}).colorHex || '#ccc' : '#666';
        ctx.fillText(
          equippedTier > 0 ? `Equipped: Tier ${equippedTier} (${GEAR_TIERS[equippedTier].label})` : 'Nothing equipped',
          x + 14, y + 42
        );

        ctx.textAlign = 'right';
        ctx.fillStyle = '#e8a33d';
        ctx.font = '10px monospace';
        ctx.fillText(`owned: [${ownedTiers.length ? [...new Set(ownedTiers)].sort().join(',') : '-'}]`, x + rowW - 14, y + 42);
        ctx.textAlign = 'left';

        gearRowRects.push({ slot, x, y, w: rowW, h: rowH });
      });

      // Done button
      const doneW = 120, doneH = 34;
      const doneX = W / 2 - doneW / 2, doneY = H - 70;
      ctx.fillStyle = '#2a2a2a';
      ctx.strokeStyle = '#3ec93e';
      roundRectPath(ctx, doneX, doneY, doneW, doneH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#3ec93e';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('DONE', W / 2, doneY + doneH / 2 + 4);
      gearRowRects.push({ slot: '__DONE__', x: doneX, y: doneY, w: doneW, h: doneH });
    },

    /**
     * @param {number} tapX
     * @param {number} tapY
     * @param {object} smartPlayState
     * @returns {string|null} 'OPEN_GEAR' if the gear tab was tapped, the call
     *   id if a Smart Play card was tapped, or null if the tap missed everything
     */
    handleTap(tapX, tapY, smartPlayState) {
      for (const rect of cardRects) {
        if (tapX >= rect.x && tapX <= rect.x + rect.w && tapY >= rect.y && tapY <= rect.y + rect.h) {
          if (rect.id === '__OPEN_GEAR__') return 'OPEN_GEAR';
          focusedIndex = rect.index; // tapping a card also brings it into focus
          selectSmartPlay(smartPlayState, rect.id);
          return rect.id;
        }
      }
      return null;
    },

    /**
     * @param {number} tapX
     * @param {number} tapY
     * @param {object} saveData
     * @returns {string|null} 'DONE' if the done button was tapped, the slot
     *   name if a gear row was cycled, or null if the tap missed everything
     */
    handleGearTap(tapX, tapY, saveData) {
      for (const rect of gearRowRects) {
        if (tapX >= rect.x && tapX <= rect.x + rect.w && tapY >= rect.y && tapY <= rect.y + rect.h) {
          if (rect.slot === '__DONE__') return 'DONE';
          const owned = [...new Set(saveData.gear.owned[rect.slot])].sort((a, b) => a - b);
          if (owned.length === 0) return rect.slot; // nothing owned, nothing to cycle
          const current = saveData.gear.equipped[rect.slot];
          const currentIdx = owned.indexOf(current);
          const nextTier = currentIdx === -1 || currentIdx === owned.length - 1
            ? (current === 0 ? owned[0] : 0) // cycle: unequipped -> lowest owned -> ... -> highest -> unequipped
            : owned[currentIdx + 1];
          saveData.gear.equipped[rect.slot] = nextTier;
          return rect.slot;
        }
      }
      return null;
    }
  };
}

/** Simple word-wrap for the flavor text inside each card. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', lineY = y;
  for (const word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line, x, lineY);
      line = word + ' ';
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, lineY);
}
