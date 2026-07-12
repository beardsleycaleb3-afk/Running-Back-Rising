// ============================================================================
// GAME-STATE.JS — Layer 2b
// WHAT:  The single top-level state machine: MENU, PLAYING, BETWEEN_PLAYS,
//        SKILL_MENU, PAUSED, GAME_OVER. Also owns the play-by-play log
//        (a simple array of strings/events the HUD can display, like a real
//        broadcast ticker: "3rd & 7 — Juked past the linebacker for +12").
// HOW:   A finite state machine with an explicit transition table. Illegal
//        transitions throw (e.g. you cannot go SKILL_MENU -> GAME_OVER
//        directly). This is the "helper of helpers" — it owns clock.js and
//        will later own xp-skills.js, but doesn't do rendering or physics
//        itself.
// WHEN:  Ticked once per fixed-step frame, before rendering.
// WHY:   "Menus for skill points between plays" needs a real state boundary —
//        without one, skill-tree UI and live gameplay input can bleed into
//        each other (a swipe meant for the menu accidentally moving the
//        player). A strict FSM prevents that class of bug entirely.
// WHERE: js/game-state.js — depends on clock.js, config.js.
// WHO:   Assistant-A owns the FSM/transition table. Assistant-B owns what
//        actually appears in the play-by-play log (the "feel"/flavor text).
// ============================================================================

defineModule('game-state.js', {
  what: 'Top-level FSM (MENU/PLAYING/BETWEEN_PLAYS/SKILL_MENU/PAUSED/GAME_OVER) + play-by-play log',
  how: 'Explicit transition table, throws on illegal transitions',
  when: 'Ticked once per fixed-step frame before render',
  why: 'Hard state boundaries prevent input/logic bleed between gameplay and menus',
  where: 'js/game-state.js — depends on clock.js, config.js',
  who: 'Assistant-A (FSM correctness), Assistant-B (play-by-play flavor text)',
  exports: ['createGameStateManager', 'GAME_STATES'],
  dependsOn: ['contract.js', 'config.js', 'clock.js']
});

const GAME_STATES = Object.freeze({
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  BETWEEN_PLAYS: 'BETWEEN_PLAYS',   // short pause, play-by-play log updates, play clock runs
  SKILL_MENU: 'SKILL_MENU',         // player is spending skill points, game clock frozen
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
});

// Explicit legal-transition table. If a transition isn't listed here, it's illegal.
const LEGAL_TRANSITIONS = Object.freeze({
  MENU:          ['PLAYING'],
  PLAYING:       ['BETWEEN_PLAYS', 'PAUSED', 'GAME_OVER'],
  BETWEEN_PLAYS: ['PLAYING', 'SKILL_MENU', 'PAUSED'],
  // PLAYING included here because the play-clock auto-resume (see update()
  // below) can fire while the player is still in the gear screen — without
  // this, that auto-resume throws and crashes the game. Found by actually
  // building and testing the gear screen; previously SKILL_MENU was defined
  // but never reachable, so this bug was dormant.
  SKILL_MENU:    ['BETWEEN_PLAYS', 'PAUSED', 'PLAYING'],
  PAUSED:        ['PLAYING', 'BETWEEN_PLAYS', 'SKILL_MENU', 'MENU'],
  GAME_OVER:     ['MENU']
});

const MAX_LOG_ENTRIES = 20;

/**
 * @returns {object} a game state manager instance
 */
function createGameStateManager() {
  const clock = createGameClock();

  return {
    current: GAME_STATES.MENU,
    clock,
    playByPlayLog: [],

    /**
     * Attempt a state transition. Throws if illegal — this is intentional,
     * loud failure beats silently ignoring a bad transition.
     * @param {string} nextState
     */
    transitionTo(nextState) {
      const allowed = LEGAL_TRANSITIONS[this.current];
      if (!allowed || !allowed.includes(nextState)) {
        throw new Error(
          `[game-state.js] Illegal transition: ${this.current} -> ${nextState}. ` +
          `Allowed from ${this.current}: [${(allowed || []).join(', ')}]`
        );
      }

      // Side effects on entering certain states
      if (nextState === GAME_STATES.PLAYING) this.clock.start();
      if (nextState === GAME_STATES.BETWEEN_PLAYS) {
        this.clock.stop();
        this.clock.resetPlayClock();
      }
      if (nextState === GAME_STATES.SKILL_MENU) this.clock.stop();
      if (nextState === GAME_STATES.PAUSED) this.clock.stop();

      this.current = nextState;
    },

    /**
     * Push a play-by-play event to the log (ring buffer, caps at MAX_LOG_ENTRIES).
     * @param {string} text e.g. "3rd & 7 — Juked past the linebacker for +12"
     */
    logPlay(text) {
      this.playByPlayLog.push(text);
      if (this.playByPlayLog.length > MAX_LOG_ENTRIES) {
        this.playByPlayLog.shift();
      }
    },

    /**
     * Call once per fixed-step frame. Advances the clock if in PLAYING,
     * or ticks the play-clock countdown if in BETWEEN_PLAYS/SKILL_MENU,
     * auto-resuming play if the player dawdles too long on the skill menu.
     * @param {number} dt seconds
     */
    update(dt) {
      if (this.current === GAME_STATES.PLAYING) {
        const events = this.clock.update(dt);
        if (events.quarterEnded) this.logPlay(`— End of quarter ${this.clock.quarter - 1} —`);
        if (events.gameEnded) this.transitionTo(GAME_STATES.GAME_OVER);
      } else if (
        this.current === GAME_STATES.BETWEEN_PLAYS ||
        this.current === GAME_STATES.SKILL_MENU
      ) {
        const autoResume = this.clock.tickPlayClock(dt);
        if (autoResume) this.transitionTo(GAME_STATES.PLAYING);
      }
    }
  };
}
