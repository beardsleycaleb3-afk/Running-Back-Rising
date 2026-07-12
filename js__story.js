// ============================================================================
// STORY.JS — Layer 7a
// WHAT:  The full narrative arc, segmented into 4 acts across the 12 runs,
//        plus outcome-dependent framing text for every run (a different
//        beat depending on whether you crushed it, scraped by, or got
//        stuffed) and a Hall of Fame induction epilogue at the very end.
// HOW:   STORY_ACTS groups chapterIndex ranges under a theme. Each run in
//        RUN_NARRATIVE has an `intro` (shown on the buffer/loading screen
//        before the run — richer than career-progression.js's one-liner)
//        and an `outcomes` object keyed by performance tier (DOMINANT /
//        SOLID / SHAKY / STUFFED), each with its own outro line.
// WHEN:  getStoryIntro(chapterIndex) read by the buffer/loading screen
//        before a run starts. getStoryOutcome(chapterIndex, performanceTier)
//        read right after a run ends, before transitioning to the next one.
// WHY:   "Segmented full story and sweet framing" — a runner without a
//        narrative through-line is just a scoreboard. This is what turns
//        12 mechanically-similar runs into an actual career arc the player
//        feels invested in finishing.
// WHERE: js/story.js — depends on config.js, career-progression.js.
// WHO:   Assistant-A (structural — every run has intro + all 4 outcome
//        tiers, nothing falls through). Assistant-B (does the writing
//        actually land? is Act 3 the emotional peak it should be?).
// ============================================================================

defineModule('story.js', {
  what: 'Segmented 4-act story arc with per-run intro + outcome-tiered narrative framing',
  how: 'STORY_ACTS groups chapters by theme; RUN_NARRATIVE has intro + 4 outcome tiers per run',
  when: 'Intro read before a run starts; outcome read right after it ends',
  why: 'Turns 12 mechanically-similar runs into a felt career arc, not just a scoreboard',
  where: 'js/story.js — depends on config.js, career-progression.js',
  who: 'Assistant-A (structural completeness), Assistant-B (does the writing land?)',
  exports: ['STORY_ACTS', 'getActForChapter', 'getStoryIntro', 'getStoryOutcome', 'classifyPerformance', 'HOF_INDUCTION_EPILOGUE'],
  dependsOn: ['contract.js', 'config.js', 'career-progression.js']
});

// --- ACT STRUCTURE ----------------------------------------------------------
const STORY_ACTS = Object.freeze([
  { id: 'ACT_1_THE_PROSPECT', label: 'Act I: The Prospect', chapterStart: 0, chapterEnd: 1,
    theme: 'Nobody knows your name yet. Every run is an audition.' },
  { id: 'ACT_2_THE_CLIMB', label: 'Act II: The Climb', chapterStart: 2, chapterEnd: 4,
    theme: 'The stage gets bigger. So does the pressure.' },
  { id: 'ACT_3_THE_SHOW', label: 'Act III: The Show', chapterStart: 5, chapterEnd: 9,
    theme: 'The league finds out who you really are, one Sunday at a time.' },
  { id: 'ACT_4_THE_LEGACY', label: 'Act IV: The Legacy', chapterStart: 10, chapterEnd: 11,
    theme: 'What you\'ve already done is history. This is about how you\'re remembered.' }
]);

/**
 * @param {number} chapterIndex - 0-11
 * @returns {object|null} the matching STORY_ACTS entry
 */
function getActForChapter(chapterIndex) {
  return STORY_ACTS.find(a => chapterIndex >= a.chapterStart && chapterIndex <= a.chapterEnd) || null;
}

// --- PERFORMANCE CLASSIFICATION ---------------------------------------------
// Four outcome tiers per run, based on how the run actually went. physics.js
// (future layer) will compute these inputs from real gameplay; the
// thresholds live here so tuning "what counts as SOLID" never touches
// gameplay code.
const PERFORMANCE_THRESHOLDS = Object.freeze({
  DOMINANT_MIN_YARDS_PCT: 0.9,  // gained >=90% of the run's target distance, no big losses
  SOLID_MIN_YARDS_PCT: 0.6,
  SHAKY_MIN_YARDS_PCT: 0.3
  // below SHAKY = STUFFED
});

/**
 * @param {object} runResult - { yardsGainedPct: 0..1+, touchdownsScored: number, tackledCount: number }
 * @returns {string} one of 'DOMINANT' | 'SOLID' | 'SHAKY' | 'STUFFED'
 */
function classifyPerformance(runResult) {
  const pct = runResult.yardsGainedPct || 0;
  if (pct >= PERFORMANCE_THRESHOLDS.DOMINANT_MIN_YARDS_PCT) return 'DOMINANT';
  if (pct >= PERFORMANCE_THRESHOLDS.SOLID_MIN_YARDS_PCT) return 'SOLID';
  if (pct >= PERFORMANCE_THRESHOLDS.SHAKY_MIN_YARDS_PCT) return 'SHAKY';
  return 'STUFFED';
}

// --- PER-RUN NARRATIVE -------------------------------------------------------
// Index matches CAREER_RUNS' chapterIndex exactly (career-progression.js).
const RUN_NARRATIVE = Object.freeze([
  { // 0 - Run 1
    intro: 'The bleachers are half-empty and nobody in the stands knows your name. That changes tonight, one way or another.',
    outcomes: {
      DOMINANT: 'You put on a show nobody expected. By Monday, three schools have already called your coach.',
      SOLID: 'A clean, steady game. Nothing flashy, but the scouts in the stands wrote your name down.',
      SHAKY: 'You found the end zone once, got stopped a lot more. Still, flashes of something real.',
      STUFFED: 'A rough night. The kind every player has once. What matters is what you do with the next one.'
    }
  },
  { // 1 - Run 2
    intro: 'State championship. Your whole town is here. This is the run people will talk about for years, for better or worse.',
    outcomes: {
      DOMINANT: 'A performance for the ages. The state championship trophy has your fingerprints all over it.',
      SOLID: 'You did your part. The team\'s celebrating, and your name is on the highlight reel.',
      SHAKY: 'A hard-fought game. Didn\'t get the ring, but everyone saw what you\'re capable of.',
      STUFFED: 'It didn\'t go your way tonight. But a scout in the third row is already texting his director.'
    }
  },
  { // 2 - Run 3
    intro: 'National television. The bowl game. Whatever you do here follows you into every draft conversation from now on.',
    outcomes: {
      DOMINANT: 'A star is born, live on national TV. Analysts are already comparing you to the greats.',
      SOLID: 'A solid bowl performance. Enough to lock up your spot as a legitimate NFL prospect.',
      SHAKY: 'A gritty, unglamorous game. Sometimes that says more about you than a blowout would.',
      STUFFED: 'The bowl game humbled you. Time to go back to work — the combine is next.'
    }
  },
  { // 3 - Run 4
    intro: 'Spring practice. No crowd, no cameras — just you, the coaches, and whether you can adjust on the fly.',
    outcomes: {
      DOMINANT: 'The coaching staff is drawing up new plays just to get you the ball more.',
      SOLID: 'Steady, reliable, coachable. Exactly what a staff wants to see in the spring.',
      SHAKY: 'A few mental errors, but the physical tools are impossible to miss.',
      STUFFED: 'A tough practice. The good news: nobody outside this building will ever see it.'
    }
  },
  { // 4 - Run 5
    intro: 'Pro Day. Every stopwatch in the NFL is pointed at you. This is the last thing scouts see before draft day.',
    outcomes: {
      DOMINANT: 'The stopwatches don\'t lie. You just turned yourself into a first-round conversation.',
      SOLID: 'A professional, no-drama Pro Day. Front offices file you as "safe and productive."',
      SHAKY: 'Not your best day, but tape from the season still speaks louder than one workout.',
      STUFFED: 'A shaky Pro Day. Draft night is going to be a longer wait than you hoped.'
    }
  },
  { // 5 - Run 6
    intro: 'Welcome to the league. The Granite Bears hit like nothing you\'ve felt before. Rookie season starts now.',
    outcomes: {
      DOMINANT: 'You just announced yourself to the entire league in one afternoon.',
      SOLID: 'A grown-man performance in your first real NFL test. The vets in the locker room noticed.',
      SHAKY: 'The speed of the pro game hit you a few times. It happens to everyone once.',
      STUFFED: 'The Bears\' front seven owned this one. Welcome to the NFL — it only gets harder from here.'
    }
  },
  { // 6 - Run 7
    intro: 'Frozen field, hostile crowd. The Northland Vikings want to make an example out of the rookie.',
    outcomes: {
      DOMINANT: 'You silenced an entire stadium. That\'s a statement win, on the road, in the cold.',
      SOLID: 'A gutsy road performance in brutal conditions. Exactly what earns a locker room\'s respect.',
      SHAKY: 'The cold and the crowd noise got to you a little. Nothing a few more road games won\'t fix.',
      STUFFED: 'A tough day up north. The Vikings\' defense lived up to the hype.'
    }
  },
  { // 7 - Run 8
    intro: 'The Piedmont Panthers have the fastest secondary in the league. This is a track meet, not a fistfight.',
    outcomes: {
      DOMINANT: 'You outran the fastest secondary in football. That tape is going straight to the highlight shows.',
      SOLID: 'You held your own in a track meet against elite speed. That\'s no small thing.',
      SHAKY: 'They ran you down a couple times, but you found room when it counted.',
      STUFFED: 'Their speed was a real problem today. Film study before the next one.'
    }
  },
  { // 8 - Run 9
    intro: 'America\'s watching. The Lonestar Cowboys never play a quiet game, and neither will you.',
    outcomes: {
      DOMINANT: 'Prime time, and you were the best player on the field, full stop.',
      SOLID: 'A strong showing in the league\'s biggest spotlight game. Your national profile just grew.',
      SHAKY: 'An up-and-down day under the brightest lights in the sport.',
      STUFFED: 'A tough one, on the biggest stage. The whole country was watching, unfortunately.'
    }
  },
  { // 9 - Run 10 (Super Bowl)
    intro: 'Everything comes down to this. The Sierra Miners stand between you and a championship.',
    outcomes: {
      DOMINANT: 'CHAMPION. You just delivered the single greatest performance of your career when it mattered most.',
      SOLID: 'You did enough. The confetti is falling, and none of it happens without you.',
      SHAKY: 'A championship earned the hard way — ugly, physical, and yours anyway.',
      STUFFED: 'It wasn\'t the Super Bowl you dreamed of. But you\'ll be back — legends always are.'
    }
  },
  { // 10 - Run 11 (Pro Bowl)
    intro: 'A celebration of everyone who made it this far. For one game, there\'s no pressure — just football.',
    outcomes: {
      DOMINANT: 'MVP of the Pro Bowl. Even in an exhibition, you couldn\'t help but be the best on the field.',
      SOLID: 'A fun, relaxed showcase among the league\'s best. You belong in this company.',
      SHAKY: 'Even an exhibition had its bumps. Still — you\'re a Pro Bowler. Let that sink in.',
      STUFFED: 'A rare off day, but nobody\'s losing sleep over a Pro Bowl stat line.'
    }
  },
  { // 11 - Run 12 (Hall of Fame Game)
    intro: 'One last run against the greatest to ever play the position. Legends only.',
    outcomes: {
      DOMINANT: 'A perfect final chapter. You didn\'t just belong with the legends — you outran every single one of them.',
      SOLID: 'A worthy final run. You stood shoulder to shoulder with the greats, and held your ground.',
      SHAKY: 'Not your cleanest game, but the career that got you here speaks for itself.',
      STUFFED: 'The legends had one more lesson to teach. Even so — you\'re standing on that field. That\'s the whole story.'
    }
  }
]);

/**
 * @param {number} chapterIndex - 0-11
 * @returns {string} intro/framing text for the buffer screen before this run
 */
function getStoryIntro(chapterIndex) {
  const entry = RUN_NARRATIVE[chapterIndex];
  return entry ? entry.intro : '';
}

/**
 * @param {number} chapterIndex - 0-11
 * @param {string} performanceTier - 'DOMINANT'|'SOLID'|'SHAKY'|'STUFFED'
 * @returns {string} outcome narrative text for right after the run ends
 */
function getStoryOutcome(chapterIndex, performanceTier) {
  const entry = RUN_NARRATIVE[chapterIndex];
  if (!entry) return '';
  return entry.outcomes[performanceTier] || entry.outcomes.SOLID;
}

// --- CAREER-COMPLETE EPILOGUE ------------------------------------------------
// Shown once, after Run 12, regardless of that run's specific outcome tier —
// this is the "you made it" framing for finishing the entire career arc,
// which is what unlocks HOF_RUNNERS.HALL_OF_FAME_LEGEND in unlockables.js.
const HOF_INDUCTION_EPILOGUE = Object.freeze(
  'Years later, in a small hall filled with the greatest names the game has ever known, ' +
  'they call yours. The kid nobody knew from Run 1 is a legend now — the kind future rookies ' +
  'get compared to. This is where the story you just played becomes the one they tell next.'
);
