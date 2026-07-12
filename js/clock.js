// ============================================================================
// CLOCK.JS — Layer 2a
// WHAT:  The game chronometer. Tracks quarter, game clock (counts down),
//        and play clock (time between plays / skill menu). A "helper" that
//        every higher-level system (game-state, HUD) reads from but never
//        mutates directly — only clock.js's own functions change its time.
// HOW:   Plain object + pure update(dt) function. No DOM, no rendering.
// WHEN:  ticks every fixed-step update while gameState === 'PLAYING'.
//        Pauses automatically during 'BETWEEN_PLAYS' / 'SKILL_MENU' states.
// WHY:   Play-by-play games need a real clock the player can feel — quarters
//        ending, 2-minute warning tension, etc. Isolating it means game-state.js
//        can ask "is time up?" without owning any timing math itself.
// WHERE: js/clock.js — depends on config.js only.
// WHO:   Assistant-A owns the timing math. Assistant-B tunes pacing (how long
//        a "chapter" should feel in-game vs real seconds).
// ============================================================================

defineModule('clock.js', {
  what: 'Game chronometer: quarter, countdown game clock, play clock',
  how: 'Plain object + pure update(dt), no DOM/render side effects',
  when: 'Ticks every fixed-step frame during PLAYING state only',
  why: 'Isolates all timing math so game-state.js stays a pure orchestrator',
  where: 'js/clock.js — depends on config.js',
  who: 'Assistant-A (timing math), Assistant-B (pacing/feel tuning)',
  exports: ['GameClock', 'createGameClock'],
  dependsOn: ['contract.js', 'config.js']
});

const CLOCK_CONFIG = Object.freeze({
  QUARTER_SECONDS: 90,      // in-game seconds per quarter (compressed, not real 15min)
  QUARTERS_PER_GAME: 4,
  PLAY_CLOCK_SECONDS: 8,    // time allowed in BETWEEN_PLAYS/menu before auto-resume
  TWO_MINUTE_WARNING: 20    // seconds remaining that trigger a UI pulse
});

/**
 * @returns {object} a fresh GameClock instance
 */
function createGameClock() {
  return {
    quarter: 1,
    secondsRemaining: CLOCK_CONFIG.QUARTER_SECONDS,
    playClockRemaining: CLOCK_CONFIG.PLAY_CLOCK_SECONDS,
    running: false,
    gameOver: false,

    /** Start the game clock ticking (called when entering PLAYING state) */
    start() { this.running = true; },

    /** Stop the game clock (called entering BETWEEN_PLAYS/SKILL_MENU/PAUSED) */
    stop() { this.running = false; },

    /**
     * Advance the clock by dt seconds. No-op if not running.
     * @param {number} dt seconds
     * @returns {{quarterEnded:boolean, gameEnded:boolean}} events this tick
     */
    update(dt) {
      const events = { quarterEnded: false, gameEnded: false };
      if (!this.running || this.gameOver) return events;

      this.secondsRemaining -= dt;
      if (this.secondsRemaining <= 0) {
        events.quarterEnded = true;
        this.quarter += 1;
        if (this.quarter > CLOCK_CONFIG.QUARTERS_PER_GAME) {
          this.gameOver = true;
          events.gameEnded = true;
          this.running = false;
        } else {
          this.secondsRemaining = CLOCK_CONFIG.QUARTER_SECONDS;
        }
      }
      return events;
    },

    /** Ticks the between-play menu countdown; returns true when it hits 0 */
    tickPlayClock(dt) {
      this.playClockRemaining -= dt;
      if (this.playClockRemaining <= 0) {
        this.playClockRemaining = CLOCK_CONFIG.PLAY_CLOCK_SECONDS;
        return true; // auto-resume signal
      }
      return false;
    },

    resetPlayClock() {
      this.playClockRemaining = CLOCK_CONFIG.PLAY_CLOCK_SECONDS;
    },

    isTwoMinuteWarning() {
      return this.secondsRemaining <= CLOCK_CONFIG.TWO_MINUTE_WARNING;
    },

    /** @returns {string} formatted "Q1 1:23" style string for HUD */
    formatted() {
      const s = Math.max(0, Math.ceil(this.secondsRemaining));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `Q${this.quarter}  ${m}:${rem.toString().padStart(2, '0')}`;
    }
  };
}
