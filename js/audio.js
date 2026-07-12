// ============================================================================
// AUDIO.JS — Layer 9b
// WHAT:  SFX + music playback via the Web Audio API. Pooled SFX voices (no
//        per-play allocation), a single music channel with crossfade between
//        loops. Every sound is looked up through ASSET_MANIFEST.audio —
//        missing files (all of them, right now) simply don't play. No
//        errors, no silent crashes, exactly the same "graceful gap" pattern
//        sprite-loader.js uses for missing art.
// HOW:   One shared AudioContext. playSfx(key) fetches+decodes+caches a
//        buffer the first time it's played, then reuses the decoded buffer
//        for every subsequent play (decode is the expensive part). Music
//        uses two alternating <audio>-backed gain nodes for crossfading
//        between menu/low-intensity/high-intensity loops.
// WHEN:  playSfx() called from collision-resolution.js result handling,
//        ability activation, level-up, etc (wiring TODO — the plumbing
//        exists now, individual call-sites get added as those moments are
//        reached in render-core.js). setMusicTrack() called on state changes.
// WHY:   Zero audio existed before this. This is the real system, ready to
//        light up the instant real files land at the exact paths in
//        ASSET_CHECKLIST.txt — no code changes needed then, same promise
//        sprite-loader.js already makes for art.
// WHERE: js/audio.js — depends on asset-manifest.js.
// WHO:   Assistant-A (WebAudio correctness, no leaked nodes/buffers).
//        Assistant-B (does the music crossfade timing feel natural once
//        real files exist?).
// ============================================================================

defineModule('audio.js', {
  what: 'WebAudio SFX pool + crossfading music channel, silent-safe for missing files',
  how: 'One shared AudioContext, decoded-buffer cache for SFX, two alternating gain nodes for music',
  when: 'playSfx() on gameplay events, setMusicTrack() on state changes',
  why: 'Real audio plumbing ready to activate the moment real files are uploaded, zero code changes then',
  where: 'js/audio.js — depends on asset-manifest.js',
  who: 'Assistant-A (WebAudio correctness), Assistant-B (crossfade feel once files exist)',
  exports: ['createAudioSystem'],
  dependsOn: ['contract.js', 'asset-manifest.js']
});

function createAudioSystem() {
  let ctx = null; // created lazily — mobile Chrome requires a user gesture first
  const bufferCache = new Map(); // manifest key -> decoded AudioBuffer
  const missingLogged = new Set(); // avoid spamming the console every frame
  let musicGainA = null, musicGainB = null, musicSourceA = null, musicSourceB = null;
  let activeMusicIsA = true;
  let currentMusicKey = null;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      musicGainA = ctx.createGain();
      musicGainB = ctx.createGain();
      musicGainA.gain.value = 0;
      musicGainB.gain.value = 0;
      musicGainA.connect(ctx.destination);
      musicGainB.connect(ctx.destination);
    }
    return ctx;
  }

  /**
   * @param {string} manifestKey - key into ASSET_MANIFEST.audio
   * @returns {Promise<AudioBuffer|null>} decoded buffer, or null if the file is missing
   */
  async function loadBuffer(manifestKey) {
    if (bufferCache.has(manifestKey)) return bufferCache.get(manifestKey);
    const entry = ASSET_MANIFEST.audio[manifestKey];
    if (!entry) return null;

    try {
      const response = await fetch(entry.path);
      if (!response.ok) throw new Error('404');
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ensureContext().decodeAudioData(arrayBuffer);
      bufferCache.set(manifestKey, audioBuffer);
      return audioBuffer;
    } catch (err) {
      if (!missingLogged.has(manifestKey)) {
        missingLogged.add(manifestKey);
        console.warn(`[audio.js] "${manifestKey}" not found at ${entry.path} — silent until uploaded.`);
      }
      bufferCache.set(manifestKey, null); // cache the miss so we don't re-fetch every call
      return null;
    }
  }

  return {
    /**
     * Must be called once from a real user gesture (a tap) before any sound
     * can play — mobile Chrome blocks audio otherwise. Safe to call
     * repeatedly; only does real work the first time.
     */
    unlock() {
      ensureContext();
      if (ctx.state === 'suspended') ctx.resume();
    },

    /**
     * Plays a one-shot sound effect. No-ops silently if the file hasn't
     * been uploaded yet — never throws, never blocks gameplay.
     * @param {string} manifestKey - e.g. 'sfxTackleHit'
     * @param {number} volume - 0..1, default 1
     */
    async playSfx(manifestKey, volume = 1) {
      const buffer = await loadBuffer(manifestKey);
      if (!buffer || !ctx) return; // missing file or context not unlocked yet — silent no-op
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    },

    /**
     * Crossfades to a new music loop. No-ops silently if the file is missing.
     * @param {string} manifestKey - e.g. 'musicGameLow'
     * @param {number} fadeSeconds
     */
    async setMusicTrack(manifestKey, fadeSeconds = 1.5) {
      if (manifestKey === currentMusicKey) return; // already playing this track
      const buffer = await loadBuffer(manifestKey);
      if (!buffer || !ctx) return;

      const incomingGain = activeMusicIsA ? musicGainB : musicGainA;
      const outgoingGain = activeMusicIsA ? musicGainA : musicGainB;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(incomingGain);
      source.start(0);

      const now = ctx.currentTime;
      incomingGain.gain.cancelScheduledValues(now);
      incomingGain.gain.setValueAtTime(0, now);
      incomingGain.gain.linearRampToValueAtTime(1, now + fadeSeconds);
      outgoingGain.gain.cancelScheduledValues(now);
      outgoingGain.gain.setValueAtTime(outgoingGain.gain.value, now);
      outgoingGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);

      if (activeMusicIsA) { if (musicSourceB) musicSourceB.stop(now + fadeSeconds + 0.1); musicSourceB = source; }
      else { if (musicSourceA) musicSourceA.stop(now + fadeSeconds + 0.1); musicSourceA = source; }

      activeMusicIsA = !activeMusicIsA;
      currentMusicKey = manifestKey;
    }
  };
}
