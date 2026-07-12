// ============================================================================
// RENDER-CORE.JS — Layer 2f (the orchestrator / "helper of helpers")
// WHAT:  Owns the canvas + context, the shared 2.5D projection math
//        (projectZ, laneToX) that every rendering agent uses, and the
//        fixed-step game loop that ties clock.js + game-state.js + the
//        three rendering agents (scene/defenders/player) together.
// HOW:   requestAnimationFrame loop with a fixed-step accumulator, targeting
//        GAME_CONFIG.TARGET_FPS (30). Render order every frame is strictly:
//        scene -> defenders -> player -> HUD-overlay-hooks. This file does
//        NOT contain gameplay logic — it only sequences the helpers, per
//        contract.js's rule that game.js/render-core.js stay thin.
// WHEN:  Boots once at startup, runs forever until the tab is closed.
// WHY:   You asked for "every helper gets a helper" connected via the
//        contract — this file IS that connective tissue. It never draws
//        anything itself; it only calls the three renderer agents in order
//        and advances clock/state. That's the entire job.
// WHERE: js/render-core.js — depends on config.js, clock.js, game-state.js.
//        render-scene.js / render-defenders.js / render-player.js depend on
//        THIS file (for projectZ/laneToX), not the other way around.
// WHO:   Assistant-A (loop correctness, frame timing, perf).
//        Assistant-B (does 30fps feel smooth in practice on the real phone?).
// ============================================================================

defineModule('render-core.js', {
  what: 'Canvas setup, shared 2.5D projection math, fixed-step loop orchestration',
  how: 'RAF loop + accumulator targeting TARGET_FPS, sequences scene->defenders->player',
  when: 'Boots once at startup, runs continuously',
  why: 'Central "helper of helpers" — connective tissue only, no gameplay logic itself',
  where: 'js/render-core.js — depends on config.js, clock.js, game-state.js, sprite-loader.js, canvas-layer-manager.js, career-progression.js, physics.js, overlay-ui.js, smart-play.js, abilities.js, save.js, menus.js, skill-tree.js, audio.js',
  who: 'Assistant-A (loop/perf correctness), Assistant-B (real-device feel at 30fps)',
  exports: ['createRenderCore'],
  dependsOn: ['contract.js', 'config.js', 'clock.js', 'game-state.js', 'sprite-loader.js', 'canvas-layer-manager.js', 'career-progression.js', 'physics.js', 'overlay-ui.js', 'smart-play.js', 'abilities.js', 'save.js', 'menus.js', 'skill-tree.js', 'audio.js']
});

/**
 * Projects a world-depth value (0 = at player, 1 = at horizon) into
 * screen scale + Y position. Shared by every rendering agent so they all
 * agree on the exact same "camera."
 * @param {number} z
 * @returns {{scale:number, screenY:number}}
 */
function projectZ(z) {
  const t = Math.min(Math.max(z, 0), 1);
  const horizonY = GAME_CONFIG.GAME_HEIGHT * GAME_CONFIG.HORIZON_Y_RATIO;
  const scale = GAME_CONFIG.NEAR_SCALE + (GAME_CONFIG.FAR_SCALE - GAME_CONFIG.NEAR_SCALE) * t;
  const screenY = horizonY + (GAME_CONFIG.GAME_HEIGHT - horizonY) * (1 - t);
  return { scale, screenY };
}

/**
 * Converts a lane index (integer range is -(LANE_COUNT-1)/2 .. +(LANE_COUNT-1)/2,
 * e.g. -3..3 for 7 lanes — can be fractional mid-slide) plus depth into a
 * screen X coordinate. Lanes converge toward the horizon (narrower spread
 * the farther away, per LANE_FAR_SPREAD_PX vs LANE_NEAR_SPREAD_PX).
 * @param {number} lane
 * @param {number} z
 * @returns {number} screenX
 */
function laneToX(lane, z) {
  const t = Math.min(Math.max(z, 0), 1);
  const spread = GAME_CONFIG.LANE_NEAR_SPREAD_PX +
    (GAME_CONFIG.LANE_FAR_SPREAD_PX - GAME_CONFIG.LANE_NEAR_SPREAD_PX) * t;
  return GAME_CONFIG.GAME_WIDTH / 2 + lane * spread;
}

const projection = Object.freeze({ projectZ, laneToX });

/**
 * @param {HTMLCanvasElement} canvasEl
 * @returns {object} the render core instance
 */
function createRenderCore(canvasEl) {
  const dpr = Math.min(window.devicePixelRatio || 1, GAME_CONFIG.DPR_CAP);
  canvasEl.width = GAME_CONFIG.GAME_WIDTH * dpr;
  canvasEl.height = GAME_CONFIG.GAME_HEIGHT * dpr;
  canvasEl.style.width = GAME_CONFIG.GAME_WIDTH + 'px';
  canvasEl.style.height = GAME_CONFIG.GAME_HEIGHT + 'px';
  const mainCtx = canvasEl.getContext('2d');
  mainCtx.scale(dpr, dpr);

  const spriteLoader = createSpriteLoader();
  const sceneRenderer = createSceneRenderer('high_school_field', spriteLoader);
  const defenderRenderer = createDefenderRenderer(spriteLoader);
  const playerRenderer = createPlayerRenderer(spriteLoader);
  const stateManager = createGameStateManager();
  const layerManager = createLayerManager();
  const overlayUI = createOverlayUI();
  const menuScreens = createMenuScreens(spriteLoader);
  const abilityController = createAbilityController();
  const audioSystem = createAudioSystem();
  const smartPlayState = createSmartPlayState();

  // --- Real save data, loaded once at boot. Career progress, owned gear,
  // equipped loadout, and lifetime stats all come from here now — not
  // hardcoded demo values. A brand-new player gets createDefaultSave()
  // (Run 1, no gear equipped) via save.js's own fallback. -------------------
  const saveData = loadGame();
  let currentChapterIndex = Math.max(0, Math.min(CAREER_RUNS.length - 1, saveData.career.chaptersCompleted));
  let physicsWorld = createPhysicsWorld(currentChapterIndex, saveData.gear.equipped, abilityController, null, saveData);
  physicsWorld.player.teamKey = saveData.career.teamKey; // null until drafted — render-player.js already handles that

  // --- Register one offscreen canvas layer per rendering agent, PLUS the
  // overlay layer on top at the highest zIndex. -----------------------------
  layerManager.createLayer('scene', 0, (ctx) => {
    sceneRenderer.render(ctx);
  });
  layerManager.createLayer('defenders', 1, (ctx) => {
    defenderRenderer.render(ctx, physicsWorld.spawner.pool, projection);
  });
  layerManager.createLayer('player', 2, (ctx) => {
    playerRenderer.render(ctx, physicsWorld.player, projection);
  });
  layerManager.createLayer('overlay', 3, (ctx) => {
    // Blank (transparent, does nothing) unless we're actually paused between
    // plays — the layer manager clears this canvas before every redraw, so
    // simply not drawing anything here IS "no overlay visible."
    if (stateManager.current === GAME_STATES.BETWEEN_PLAYS) {
      overlayUI.render(ctx, smartPlayState, stateManager.clock.playClockRemaining);
    } else if (stateManager.current === GAME_STATES.SKILL_MENU) {
      overlayUI.renderGearScreen(ctx, saveData);
    }
  });
  layerManager.createLayer('menu', 4, (ctx) => {
    if (stateManager.current === GAME_STATES.MENU) {
      menuScreens.renderMainMenu(ctx, saveData);
    } else if (stateManager.current === GAME_STATES.GAME_OVER && stateManager.careerComplete) {
      menuScreens.renderCareerComplete(ctx, saveData);
    }
  });

  let lastTime = 0;
  let accumulator = 0;
  const fixedDtMs = GAME_CONFIG.FIXED_DT_MS;
  const fixedDtSec = fixedDtMs / 1000;

  /**
   * Applies whatever loot/XP a run produced to the persistent save — this is
   * the piece that was completely missing: rewards.js rolled loot every run,
   * but nothing ever touched saveData with it until now.
   * @param {object} eventResult - from resolveTackleCollision or resolveTouchdown
   */
  function applyRewardsToSave(eventResult) {
    if (!eventResult.loot) return; // tackled results don't carry loot, only TDs do
    const { type, detail } = eventResult.loot;
    if (type === 'stars') {
      saveData.stats.totalStars += detail.amount;
    } else if (type === 'skillPoint') {
      saveData.xp.skillPointsAvailable += detail.amount;
    } else if (type === 'gear') {
      saveData.gear.owned[detail.slot].push(detail.tier);
      // Auto-equip if this tier beats what's currently equipped in that slot —
      // simplest possible equip logic until a real gear-equip screen exists.
      if (detail.tier > saveData.gear.equipped[detail.slot]) {
        saveData.gear.equipped[detail.slot] = detail.tier;
        stateManager.logPlay(`Equipped ${detail.slot} tier ${detail.tier} — upgrade!`);
      }
    }
    if (eventResult.xpAwarded) {
      saveData.xp.currentXp += eventResult.xpAwarded;
      const needed = xpRequiredForLevel(saveData.xp.level + 1);
      if (saveData.xp.currentXp >= needed) {
        saveData.xp.level += 1;
        saveData.xp.skillPointsAvailable += 1;
        stateManager.logPlay(`LEVEL UP! Now level ${saveData.xp.level}.`);
      }
    }
  }

  /**
   * The draft — assigns the player to a team the first time they cross into
   * PRO_GAMES (chapterIndex 5). Never overwrites an existing pick on replay.
   */
  function maybeRunDraft() {
    if (saveData.career.teamKey) return; // already drafted
    if (currentChapterIndex < 5) return;   // not at PRO_GAMES yet
    const pick = DRAFT_ELIGIBLE_TEAMS[Math.floor(Math.random() * DRAFT_ELIGIBLE_TEAMS.length)];
    saveData.career.teamKey = pick;
    const teamLabel = TEAM_MASCOTS[pick].mascot.toUpperCase();
    stateManager.logPlay(`DRAFT DAY: You've been selected by the ${pick.replace('_', ' ')}! Welcome to the ${teamLabel}s.`);
    saveGame(saveData);
  }

  /**
   * Advances to the next run (or restarts the same one on a stop), applying
   * whatever Smart Play call was selected (or defaulted) for the run that's
   * about to start, and persists progress via save.js.
   * @param {boolean} advance - true on a touchdown, false on a tackle (retry)
   */
  function startNextPhysicsWorld(advance) {
    if (advance) {
      currentChapterIndex = Math.min(CAREER_RUNS.length - 1, currentChapterIndex + 1);
      saveData.career.chaptersCompleted = currentChapterIndex;
      maybeRunDraft();
      saveGame(saveData); // persist on every advance — cheap, frequent checkpoint
    }
    const callId = getDefaultSmartPlay(smartPlayState); // ensures a call is always chosen
    physicsWorld = createPhysicsWorld(currentChapterIndex, saveData.gear.equipped, abilityController, callId, saveData);
    physicsWorld.player.teamKey = saveData.career.teamKey; // carry the drafted team into the new run
    smartPlayState.pendingCallId = null;
  }

  function updateAll(dtSec) {
    stateManager.update(dtSec);

    // --- The field NEVER stops rolling, in ANY state. This is the literal
    // "keep the runner running with the field still rolling" behavior —
    // scene.update() (grass scroll) and the player's idle run-cycle bob
    // both keep animating even while physics.js itself is frozen during
    // BETWEEN_PLAYS/SKILL_MENU. Only distance/collision/defender movement
    // actually pause. -----------------------------------------------------
    sceneRenderer.update(dtSec);
    physicsWorld.player.runCyclePhase += dtSec * 6; // slow idle bob when not actively running
    layerManager.markDirty('scene');
    layerManager.markDirty('player');
    layerManager.markDirty('overlay'); // cheap no-op draw when inactive, live countdown when active
    layerManager.markDirty('menu');    // same pattern — no-op unless MENU or career-complete GAME_OVER

    if (stateManager.current === GAME_STATES.PLAYING) {
      const result = physicsWorld.update(dtSec);
      layerManager.markDirty('defenders');

      if (result.ended) {
        const { eventResult, storyOutcome, performanceTier } = result.resultPayload;
        stateManager.logPlay(eventResult.logMessage);
        stateManager.logPlay(storyOutcome);
        applyRewardsToSave(eventResult);

        const isFinalRun = currentChapterIndex === CAREER_RUNS.length - 1;
        if (isFinalRun && result.reason === 'touchdown') {
          // Career complete — Run 12 (Hall of Fame Game) finished with a TD.
          saveData.career.careerComplete = true;
          saveGame(saveData);
          stateManager.careerComplete = true;
          stateManager.transitionTo(GAME_STATES.GAME_OVER);
        } else {
          stateManager.transitionTo(GAME_STATES.BETWEEN_PLAYS);
          startNextPhysicsWorld(result.reason === 'touchdown');
        }
      }
    }

    // Auto-resume from BETWEEN_PLAYS applies the (possibly-default) Smart
    // Play call the moment PLAYING resumes, via game-state.js's own
    // play-clock countdown — see game-state.js:update().
    if (stateManager.current !== GAME_STATES.PLAYING) {
      getDefaultSmartPlay(smartPlayState); // ensures a call is always set before resuming
    }
  }

  function renderAll() {
    layerManager.processDirtyQueue();   // redraw only what's dirty, into offscreen canvases
    layerManager.compositeAll(mainCtx); // cheap blit of all layers onto the visible canvas
  }

  function loop(now) {
    const frameTime = Math.min(now - lastTime, 250);
    lastTime = now;
    accumulator += frameTime;

    let steps = 0;
    while (accumulator >= fixedDtMs && steps < GAME_CONFIG.MAX_FRAME_SKIP) {
      updateAll(fixedDtSec);
      accumulator -= fixedDtMs;
      steps++;
    }

    renderAll();
    requestAnimationFrame(loop);
  }

  return {
    mainCtx, stateManager, projection, sceneRenderer, spriteLoader, layerManager,
    overlayUI, smartPlayState, abilityController, audioSystem,
    get world() { return { player: physicsWorld.player, defenders: physicsWorld.spawner.pool }; },
    get physicsWorld() { return physicsWorld; },
    /**
     * Forwards a tap to whichever overlay is currently active. Returns true
     * if the overlay consumed the tap (so the caller — index.html's pointer
     * handler — knows not to treat it as a lane-swipe instead).
     * @param {number} x canvas-space x
     * @param {number} y canvas-space y
     * @returns {boolean}
     */
    handleOverlayTap(x, y) {
      if (stateManager.current === GAME_STATES.MENU) {
        if (menuScreens.handleMainMenuTap(x, y)) {
          audioSystem.unlock(); // first real user gesture — safe point to unlock WebAudio
          stateManager.transitionTo(GAME_STATES.PLAYING);
          return true;
        }
        return false;
      }
      if (stateManager.current === GAME_STATES.GAME_OVER && stateManager.careerComplete) {
        if (menuScreens.handleMainMenuTap(x, y)) { // reuses the same button-rect tracking
          // NEW CAREER — full reset
          Object.assign(saveData, createDefaultSave());
          saveGame(saveData);
          currentChapterIndex = 0;
          startNextPhysicsWorld(false);
          stateManager.careerComplete = false;
          stateManager.transitionTo(GAME_STATES.MENU);
          return true;
        }
        return false;
      }
      if (stateManager.current === GAME_STATES.BETWEEN_PLAYS) {
        const picked = overlayUI.handleTap(x, y, smartPlayState);
        if (picked === 'OPEN_GEAR') {
          stateManager.transitionTo(GAME_STATES.SKILL_MENU);
          return true;
        }
        return picked !== null;
      }
      if (stateManager.current === GAME_STATES.SKILL_MENU) {
        const result = overlayUI.handleGearTap(x, y, saveData);
        if (result === 'DONE') {
          saveGame(saveData); // persist gear changes the moment the player confirms
          stateManager.transitionTo(GAME_STATES.BETWEEN_PLAYS);
          return true;
        }
        return result !== null;
      }
      return false;
    },
    /**
     * Loads all manifest assets, THEN shows the main menu (does NOT
     * auto-start PLAYING anymore — the player has to actually tap
     * Start/Continue, a real deliberate front door instead of a forced skip).
     * @returns {Promise<void>}
     */
    async start() {
      await spriteLoader.loadAll();
      stateManager.transitionTo(GAME_STATES.MENU);
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  };
}
