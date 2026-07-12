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

function projectZ(z) {
  const t = Math.min(Math.max(z, 0), 1);
  const horizonY = GAME_CONFIG.GAME_HEIGHT * GAME_CONFIG.HORIZON_Y_RATIO;
  const scale = GAME_CONFIG.NEAR_SCALE + (GAME_CONFIG.FAR_SCALE - GAME_CONFIG.NEAR_SCALE) * t;
  const screenY = horizonY + (GAME_CONFIG.GAME_HEIGHT - horizonY) * (1 - t);
  return { scale, screenY };
}

function laneToX(lane, z) {
  const t = Math.min(Math.max(z, 0), 1);
  const spread = GAME_CONFIG.LANE_NEAR_SPREAD_PX +
    (GAME_CONFIG.LANE_FAR_SPREAD_PX - GAME_CONFIG.LANE_NEAR_SPREAD_PX) * t;
  return GAME_CONFIG.GAME_WIDTH / 2 + lane * spread;
}

const projection = Object.freeze({ projectZ, laneToX });

function createRenderCore(canvasEl) {
  const layerManager = createLayerManager();
  const spriteLoader = createSpriteLoader();
  const sceneRenderer = createSceneRenderer('high_school_field', spriteLoader);
  const defenderRenderer = createDefenderRenderer(spriteLoader);
  const playerRenderer = createPlayerRenderer(spriteLoader);
  const stateManager = createGameStateManager();
  const overlayUI = createOverlayUI();
  const menuScreens = createMenuScreens(spriteLoader);
  const abilityController = createAbilityController();
  const audioSystem = createAudioSystem();
  const smartPlayState = createSmartPlayState();

  const saveData = loadGame();
  let currentChapterIndex = Math.max(0, Math.min(CAREER_RUNS.length - 1, saveData.career.chaptersCompleted));
  let physicsWorld = createPhysicsWorld(currentChapterIndex, saveData.gear.equipped, abilityController, null, saveData);
  physicsWorld.player.teamKey = saveData.career.teamKey;

  let lastTime = 0;
  let accumulator = 0;
  const fixedDtMs = GAME_CONFIG.FIXED_DT_MS;
  const fixedDtSec = fixedDtMs / 1000;

  let mainCtx = null;
  let cssWidth = 0;
  let cssHeight = 0;
  let resizePending = true;

  function getDpr() {
    return Math.min(window.devicePixelRatio || 1, GAME_CONFIG.DPR_CAP);
  }

  function getViewportSize() {
    const rect = canvasEl.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || window.innerWidth || GAME_CONFIG.GAME_WIDTH));
    const height = Math.max(1, Math.floor(rect.height || window.innerHeight || GAME_CONFIG.GAME_HEIGHT));
    return { width, height };
  }

  function applyCanvasSize() {
    const dpr = getDpr();
    const size = getViewportSize();
    cssWidth = size.width;
    cssHeight = size.height;

    canvasEl.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvasEl.height = Math.max(1, Math.floor(cssHeight * dpr));
    canvasEl.style.width = cssWidth + 'px';
    canvasEl.style.height = cssHeight + 'px';

    mainCtx = canvasEl.getContext('2d');
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    layerManager.bindMainCanvas(canvasEl, cssWidth, cssHeight);
    sceneRenderer.setVenue('high_school_field');
    layerManager.resize(cssWidth, cssHeight);

    resizePending = false;
  }

  function applyRewardsToSave(eventResult) {
    if (!eventResult.loot) return;
    const { type, detail } = eventResult.loot;
    if (type === 'stars') {
      saveData.stats.totalStars += detail.amount;
    } else if (type === 'skillPoint') {
      saveData.xp.skillPointsAvailable += detail.amount;
    } else if (type === 'gear') {
      saveData.gear.owned[detail.slot].push(detail.tier);
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

  function maybeRunDraft() {
    if (saveData.career.teamKey) return;
    if (currentChapterIndex < 5) return;
    const pick = DRAFT_ELIGIBLE_TEAMS[Math.floor(Math.random() * DRAFT_ELIGIBLE_TEAMS.length)];
    saveData.career.teamKey = pick;
    const teamLabel = TEAM_MASCOTS[pick].mascot.toUpperCase();
    stateManager.logPlay(`DRAFT DAY: You've been selected by the ${pick.replace('_', ' ')}! Welcome to the ${teamLabel}s.`);
    saveGame(saveData);
  }

  function startNextPhysicsWorld(advance) {
    if (advance) {
      currentChapterIndex = Math.min(CAREER_RUNS.length - 1, currentChapterIndex + 1);
      saveData.career.chaptersCompleted = currentChapterIndex;
      maybeRunDraft();
      saveGame(saveData);
    }
    const callId = getDefaultSmartPlay(smartPlayState);
    physicsWorld = createPhysicsWorld(currentChapterIndex, saveData.gear.equipped, abilityController, callId, saveData);
    physicsWorld.player.teamKey = saveData.career.teamKey;
    smartPlayState.pendingCallId = null;
  }

  function updateAll(dtSec) {
    stateManager.update(dtSec);
    sceneRenderer.update(dtSec);
    physicsWorld.player.runCyclePhase += dtSec * 6;

    layerManager.markDirty('scene');
    layerManager.markDirty('player');
    layerManager.markDirty('overlay');
    layerManager.markDirty('menu');

    if (stateManager.current === GAME_STATES.PLAYING) {
      const result = physicsWorld.update(dtSec);
      layerManager.markDirty('defenders');

      if (result.ended) {
        const { eventResult, storyOutcome } = result.resultPayload;
        stateManager.logPlay(eventResult.logMessage);
        stateManager.logPlay(storyOutcome);
        applyRewardsToSave(eventResult);

        const isFinalRun = currentChapterIndex === CAREER_RUNS.length - 1;
        if (isFinalRun && result.reason === 'touchdown') {
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

    if (stateManager.current !== GAME_STATES.PLAYING) {
      getDefaultSmartPlay(smartPlayState);
    }
  }

  function renderAll() {
    if (resizePending) applyCanvasSize();
    layerManager.processDirtyQueue();
    layerManager.compositeAll(mainCtx);
  }

  function loop(now) {
    if (resizePending) applyCanvasSize();

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

  function handleResize() {
    resizePending = true;
  }

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });

  return {
    get mainCtx() { return mainCtx; },
    stateManager,
    projection,
    sceneRenderer,
    spriteLoader,
    layerManager,
    overlayUI,
    smartPlayState,
    abilityController,
    audioSystem,
    get world() { return { player: physicsWorld.player, defenders: physicsWorld.spawner.pool }; },
    get physicsWorld() { return physicsWorld; },

    handleOverlayTap(x, y) {
      if (stateManager.current === GAME_STATES.MENU) {
        if (menuScreens.handleMainMenuTap(x, y)) {
          audioSystem.unlock();
          stateManager.transitionTo(GAME_STATES.PLAYING);
          return true;
        }
        return false;
      }
      if (stateManager.current === GAME_STATES.GAME_OVER && stateManager.careerComplete) {
        if (menuScreens.handleMainMenuTap(x, y)) {
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
          saveGame(saveData);
          stateManager.transitionTo(GAME_STATES.BETWEEN_PLAYS);
          return true;
        }
        return result !== null;
      }
      return false;
    },

    async start() {
      await spriteLoader.loadAll();
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

      resizePending = true;
      stateManager.transitionTo(GAME_STATES.MENU);
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  };
}
