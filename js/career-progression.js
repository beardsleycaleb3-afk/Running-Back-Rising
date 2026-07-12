// ============================================================================
// CAREER-PROGRESSION.JS — Layer 6a
// WHAT:  The exact run-by-run table: all 12 runs from High School Scouted
//        through the Hall of Fame Game. Each run declares its opponent
//        defender-type mix, its venue/backdrop, its difficulty multiplier,
//        and the narrative beat shown on the buffer/loading screen before it.
// HOW:   Pure-data array, index = chapterIndex (0-11), matching
//        GAME_CONFIG.TOTAL_CHAPTERS and the unlockAtChapter values already
//        in CAREER_STAGES (config.js). Nothing here is randomized — the
//        SEQUENCE is fixed and readable top to bottom, which is exactly
//        "run 1 to run 12" as a table you can read in order.
// WHEN:  career.js (next layer) reads CAREER_RUNS[chapterIndex] whenever a
//        run starts, to configure the spawner, venue renderer, and buffer
//        screen for that specific run.
// WHY:   You asked "what's it going to do, run by run" — this file IS that
//        answer, in a form the game actually runs on, not just prose.
// WHERE: js/career-progression.js — depends on config.js.
// WHO:   Assistant-A (structural correctness, chapterIndex math never drifts
//        from CAREER_STAGES). Assistant-B (pacing/difficulty curve, opponent
//        variety, narrative beats).
// ============================================================================

defineModule('career-progression.js', {
  what: 'The exact run-by-run table, all 12 runs from HS Scouted to Hall of Fame Game',
  how: 'Pure-data array indexed by chapterIndex (0-11), matches CAREER_STAGES exactly',
  when: 'Read by career.js whenever a run starts, to configure that run',
  why: 'Concrete run-by-run answer to "what happens each run" as runnable data, not prose',
  where: 'js/career-progression.js — depends on config.js',
  who: 'Assistant-A (structural correctness), Assistant-B (pacing/difficulty/narrative)',
  exports: ['CAREER_RUNS', 'getRun', 'getStageForChapter', 'getDefenderTeamKey'],
  dependsOn: ['contract.js', 'config.js']
});

/**
 * Each run: { chapterIndex, stageId, label, opponentTeam, venueBackdropIndex,
 *   venueType, defenderMix (BEHAVIOR/pacing weights only — how aggressively
 *   defenders rush vs. contain — NOT which art loads; visuals come entirely
 *   from opponentTeam via ASSET_MANIFEST.defenders, see getDefenderTeamKey()
 *   below), speedMultiplier, defenderCountCap, bufferScreenText }
 * opponentTeam is null for HS/college/Pro Bowl/HOF runs — those use the
 * GENERIC defender set (no named opponent identity for that run).
 */
const CAREER_RUNS = Object.freeze([
  // --- HIGH SCHOOL SCOUTED (2 runs) --------------------------------------
  {
    chapterIndex: 0, stageId: 'HS_SCOUT', label: 'Run 1: Friday Night Lights',
    opponentTeam: null, venueBackdropIndex: 3, venueType: 'high_school_field',
    defenderMix: { lineman: 0.3, cornerback: 0.3, linebacker: 0.4 },
    speedMultiplier: 1.0, defenderCountCap: 2,
    bufferScreenText: 'Every scout in the state is watching tonight. Show them what you\'ve got.'
  },
  {
    chapterIndex: 1, stageId: 'HS_SCOUT', label: 'Run 2: State Championship',
    opponentTeam: null, venueBackdropIndex: 3, venueType: 'high_school_field',
    defenderMix: { lineman: 0.25, cornerback: 0.25, linebacker: 0.3, safety: 0.2 },
    speedMultiplier: 1.05, defenderCountCap: 3,
    bufferScreenText: 'One more win and the scholarship offers start pouring in.'
  },

  // --- COLLEGE BOWL (1 run) ------------------------------------------------
  {
    chapterIndex: 2, stageId: 'COLLEGE_BOWL', label: 'Run 3: The Bowl Game',
    opponentTeam: null, venueBackdropIndex: 4, venueType: 'open_stadium',
    defenderMix: { lineman: 0.2, cornerback: 0.25, defensiveEnd: 0.2, linebacker: 0.25, safety: 0.1 },
    speedMultiplier: 1.12, defenderCountCap: 4,
    bufferScreenText: 'National television. This is where legends get their start.'
  },

  // --- COLLEGE PRACTICE (2 runs) -------------------------------------------
  {
    chapterIndex: 3, stageId: 'COLLEGE_PRACTICE', label: 'Run 4: Spring Practice',
    opponentTeam: null, venueBackdropIndex: 4, venueType: 'open_stadium',
    defenderMix: { lineman: 0.2, cornerback: 0.2, defensiveEnd: 0.2, linebacker: 0.2, safety: 0.2 },
    speedMultiplier: 1.15, defenderCountCap: 4,
    bufferScreenText: 'The coaches are drawing up new looks. Adjust or get left behind.'
  },
  {
    chapterIndex: 4, stageId: 'COLLEGE_PRACTICE', label: 'Run 5: Pro Day',
    opponentTeam: null, venueBackdropIndex: 4, venueType: 'open_stadium',
    defenderMix: { lineman: 0.15, cornerback: 0.2, defensiveEnd: 0.25, linebacker: 0.2, safety: 0.2 },
    speedMultiplier: 1.18, defenderCountCap: 5,
    bufferScreenText: 'Every NFL scout in the country is here with a stopwatch. Draft day is close.'
  },

  // --- PRO SEASON (4 runs, one per fictional opponent) ---------------------
  {
    chapterIndex: 5, stageId: 'PRO_GAMES', label: 'Run 6: vs. Granite Bears',
    opponentTeam: 'GRANITE_BEARS', venueBackdropIndex: 5, venueType: 'enclosed_stadium',
    defenderMix: { lineman: 0.2, cornerback: 0.15, defensiveEnd: 0.25, linebacker: 0.25, safety: 0.15 },
    speedMultiplier: 1.22, defenderCountCap: 5,
    bufferScreenText: 'Welcome to the show, rookie. The Bears hit like a freight train.'
  },
  {
    chapterIndex: 6, stageId: 'PRO_GAMES', label: 'Run 7: vs. Northland Vikings',
    opponentTeam: 'NORTHLAND_VIKINGS', venueBackdropIndex: 6, venueType: 'open_stadium',
    defenderMix: { lineman: 0.15, cornerback: 0.2, defensiveEnd: 0.2, linebacker: 0.25, safety: 0.2 },
    speedMultiplier: 1.25, defenderCountCap: 5,
    bufferScreenText: 'Frozen field, hostile crowd. The Vikings want to make an example of you.'
  },
  {
    chapterIndex: 7, stageId: 'PRO_GAMES', label: 'Run 8: vs. Piedmont Panthers',
    opponentTeam: 'PIEDMONT_PANTHERS', venueBackdropIndex: 7, venueType: 'open_stadium',
    defenderMix: { lineman: 0.15, cornerback: 0.25, defensiveEnd: 0.2, linebacker: 0.2, safety: 0.2 },
    speedMultiplier: 1.28, defenderCountCap: 6,
    bufferScreenText: 'The Panthers\' secondary is the fastest in the league. Cut it loose early.'
  },
  {
    chapterIndex: 8, stageId: 'PRO_GAMES', label: 'Run 9: vs. Lonestar Cowboys',
    opponentTeam: 'LONESTAR_COWBOYS', venueBackdropIndex: 1, venueType: 'open_stadium',
    defenderMix: { lineman: 0.2, cornerback: 0.2, defensiveEnd: 0.2, linebacker: 0.2, safety: 0.2 },
    speedMultiplier: 1.3, defenderCountCap: 6,
    bufferScreenText: 'America is watching. The Cowboys never play a quiet game.'
  },

  // --- SUPER BOWL (1 run) ---------------------------------------------------
  {
    chapterIndex: 9, stageId: 'SUPER_BOWL', label: 'Run 10: The Super Bowl',
    opponentTeam: 'SIERRA_MINERS', venueBackdropIndex: 2, venueType: 'enclosed_stadium',
    defenderMix: { lineman: 0.15, cornerback: 0.2, defensiveEnd: 0.2, linebacker: 0.25, safety: 0.2 },
    speedMultiplier: 1.4, defenderCountCap: 6,
    bufferScreenText: 'Everything you\'ve worked for comes down to this one run.'
  },

  // --- PRO BOWL (1 run) -------------------------------------------------------
  {
    chapterIndex: 10, stageId: 'PRO_BOWL', label: 'Run 11: The Pro Bowl',
    opponentTeam: null, venueBackdropIndex: 8, venueType: 'open_stadium',
    defenderMix: { lineman: 0.2, cornerback: 0.2, defensiveEnd: 0.2, linebacker: 0.2, safety: 0.2 },
    speedMultiplier: 1.2, defenderCountCap: 5, // exhibition, slightly gentler than Super Bowl
    bufferScreenText: 'A celebration of everyone who made it here. Enjoy this one.'
  },

  // --- HALL OF FAME GAME (1 run) -----------------------------------------------
  {
    chapterIndex: 11, stageId: 'HOF_GAME', label: 'Run 12: Hall of Fame Game',
    opponentTeam: null, venueBackdropIndex: 4, venueType: 'open_stadium',
    defenderMix: { lineman: 0.15, cornerback: 0.15, defensiveEnd: 0.2, linebacker: 0.25, safety: 0.25 },
    speedMultiplier: 1.5, defenderCountCap: 6, // the hardest run in the game, by design
    bufferScreenText: 'One last run against the greatest to ever play. Legends only.'
  }
]);

/**
 * @param {number} chapterIndex - 0-11
 * @returns {object|null} the run definition, or null if out of range
 */
function getRun(chapterIndex) {
  return CAREER_RUNS[chapterIndex] || null;
}

/**
 * @param {number} chapterIndex - 0-11
 * @returns {object|null} the matching CAREER_STAGES entry (config.js)
 */
function getStageForChapter(chapterIndex) {
  return CAREER_STAGES.find(stage =>
    chapterIndex >= stage.unlockAtChapter && chapterIndex < stage.unlockAtChapter + stage.chapters
  ) || null;
}

/**
 * Resolves which defender ART SET (ASSET_MANIFEST.defenders key) a given
 * run should spawn from. Named opponent -> that team's set. No opponent
 * (HS/college/Pro Bowl/HOF) -> the neutral GENERIC set.
 * @param {number} chapterIndex - 0-11
 * @returns {string} key into ASSET_MANIFEST.defenders
 */
function getDefenderTeamKey(chapterIndex) {
  const run = getRun(chapterIndex);
  return (run && run.opponentTeam) || 'GENERIC';
}
