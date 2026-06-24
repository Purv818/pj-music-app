/**
 * PJ Music — Audio Engine
 * Web Audio API processing chain:
 *
 *  <audio> → MediaElementSource
 *          → DynamicsCompressor  (loudness normalization + peak limiting)
 *          → Stereo Widener       (wider stereo image)
 *          → 10-Band EQ           (bass/mid/treble shaping)
 *          → Bass Boost           (dedicated low-end shelf)
 *          → GainNode             (master volume)
 *          → AudioContext.destination (speakers)
 *
 * Presets: Normal · Bass Boost · Vocal · Rock · Electronic · Classical · Podcast
 */

// ─── EQ Presets ──────────────────────────────────────────────────────────────
// Gains in dB for 10 bands: 32 63 125 250 500 1k 2k 4k 8k 16k Hz

export const EQ_PRESETS = {
  normal:     { label: 'Normal',      bands: [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0], bass: 0,  master: 1.0 },
  bassBoost:  { label: 'Bass Boost',  bands: [ 7,  6,  5,  3,  1,  0,  0, -1, -1, -2], bass: 6,  master: 0.95 },
  treble:     { label: 'Treble+',     bands: [-1, -1,  0,  1,  2,  2,  3,  5,  6,  7], bass:-2,  master: 0.95 },
  vocal:      { label: 'Vocal',       bands: [-3, -2, -1,  2,  4,  5,  4,  2, -1, -2], bass:-3,  master: 1.0  },
  rock:       { label: 'Rock',        bands: [ 5,  4,  3,  1,  0, -1,  1,  3,  4,  5], bass: 3,  master: 0.95 },
  electronic: { label: 'Electronic',  bands: [ 5,  4,  1,  0, -2, -1,  1,  4,  5,  4], bass: 5,  master: 0.90 },
  classical:  { label: 'Classical',   bands: [ 3,  2,  1,  0,  0,  0,  0,  1,  3,  4], bass: 1,  master: 1.0  },
  podcast:    { label: 'Podcast',     bands: [-2, -1,  0,  2,  5,  4,  3,  1,  0, -1], bass:-4,  master: 1.05 },
  lofi:       { label: 'Lo-Fi',       bands: [ 4,  3,  2,  1,  0, -2, -4, -5, -5, -6], bass: 5,  master: 0.92 },
};

const EQ_FREQUENCIES = [32, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// ─── Audio Engine State ───────────────────────────────────────────────────────

let ctx         = null;   // AudioContext
let source      = null;   // MediaElementSourceNode
let compressor  = null;   // DynamicsCompressorNode
let eqBands     = [];     // BiquadFilterNode[] — 10 bands
let bassBoost   = null;   // BiquadFilterNode — low shelf
let stereoNode  = null;   // StereoPannerNode (widener trick)
let masterGain  = null;   // GainNode

let currentPreset = 'normal';
let isInitialized = false;
let customBands   = null; // null = use preset, array = custom per-band

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialize the audio processing chain.
 * Must be called after user interaction (browser autoplay policy).
 * @param {HTMLAudioElement} audioEl
 */
export const initAudioEngine = (audioEl) => {
  if (isInitialized) return;

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Source node
    source = ctx.createMediaElementSource(audioEl);

    // ── Dynamics Compressor ──────────────────────────────────
    // Reduces loud peaks, brings up quiet parts → consistent loudness
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;   // dB — start compressing here
    compressor.knee.value      =  12;   // soft knee for musical feel
    compressor.ratio.value     =   4;   // 4:1 ratio
    compressor.attack.value    = 0.003; // 3ms — fast attack
    compressor.release.value   = 0.25;  // 250ms — natural release

    // ── 10-Band EQ ───────────────────────────────────────────
    eqBands = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
      }
      filter.frequency.value = freq;
      filter.Q.value         = 1.0;
      filter.gain.value      = 0;
      return filter;
    });

    // ── Bass Boost (dedicated low-shelf) ─────────────────────
    bassBoost = ctx.createBiquadFilter();
    bassBoost.type           = 'lowshelf';
    bassBoost.frequency.value = 100;
    bassBoost.gain.value      = 0;

    // ── Stereo Widener ────────────────────────────────────────
    // Mid/side trick using two gain nodes + channel splitter/merger
    stereoNode = createStereoWidener(ctx);

    // ── Master Gain ───────────────────────────────────────────
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;

    // ── Connect chain ─────────────────────────────────────────
    // source → compressor → eq[0..9] chain → bassBoost → stereo → master → dest
    let node = source;
    node.connect(compressor);
    node = compressor;

    eqBands.forEach(band => {
      node.connect(band);
      node = band;
    });

    node.connect(bassBoost);
    node = bassBoost;

    if (stereoNode) {
      node.connect(stereoNode.input);
      node = stereoNode.output;
    }

    node.connect(masterGain);
    masterGain.connect(ctx.destination);

    isInitialized = true;
    console.log('[AudioEngine] Initialized ✓');

    // Apply saved preset
    const saved = localStorage.getItem('pj_eq_preset') || 'normal';
    applyPreset(saved);

  } catch (err) {
    console.warn('[AudioEngine] Web Audio API not available:', err.message);
  }
};

// ─── Stereo Widener ───────────────────────────────────────────────────────────

/**
 * Creates a mid/side stereo widener.
 * Returns { input, output } AudioNodes.
 */
const createStereoWidener = (audioCtx) => {
  try {
    const splitter = audioCtx.createChannelSplitter(2);
    const merger   = audioCtx.createChannelMerger(2);

    // Mid (L+R) and Side (L-R) gains
    const midGain  = audioCtx.createGain();
    const sideGain = audioCtx.createGain();
    midGain.gain.value  = 1.0;
    sideGain.gain.value = 1.2; // Slightly widen sides

    // Input gain
    const inputGain  = audioCtx.createGain();
    const outputGain = audioCtx.createGain();

    inputGain.connect(splitter);

    // Left channel → mid and side
    splitter.connect(midGain,  0);
    splitter.connect(sideGain, 0);

    // Right channel inverted for side
    const invertGain = audioCtx.createGain();
    invertGain.gain.value = -1;
    splitter.connect(invertGain, 1);
    invertGain.connect(sideGain);

    // Re-combine: L = mid + side,  R = mid - side
    midGain.connect(merger,  0, 0);
    sideGain.connect(merger, 0, 0);
    midGain.connect(merger,  0, 1);
    sideGain.connect(merger, 0, 1);
    merger.connect(outputGain);

    return { input: inputGain, output: outputGain };
  } catch {
    return null; // Fallback — skip widener
  }
};

// ─── Preset Application ───────────────────────────────────────────────────────

/**
 * Apply a named EQ preset.
 * @param {string} presetName — key of EQ_PRESETS
 */
export const applyPreset = (presetName) => {
  const preset = EQ_PRESETS[presetName] || EQ_PRESETS.normal;
  currentPreset = presetName;
  customBands   = null;

  if (!isInitialized) {
    localStorage.setItem('pj_eq_preset', presetName);
    return;
  }

  // Apply EQ bands
  preset.bands.forEach((gainDb, i) => {
    if (eqBands[i]) {
      eqBands[i].gain.setTargetAtTime(gainDb, ctx.currentTime, 0.05);
    }
  });

  // Apply bass boost
  if (bassBoost) {
    bassBoost.gain.setTargetAtTime(preset.bass, ctx.currentTime, 0.05);
  }

  // Apply master gain
  if (masterGain) {
    masterGain.gain.setTargetAtTime(preset.master, ctx.currentTime, 0.05);
  }

  localStorage.setItem('pj_eq_preset', presetName);
  console.log(`[AudioEngine] Preset: ${preset.label}`);
};

/**
 * Set a single EQ band gain (for custom mode).
 * @param {number} bandIndex — 0-9
 * @param {number} gainDb    — dB value
 */
export const setEQBand = (bandIndex, gainDb) => {
  if (!isInitialized || !eqBands[bandIndex]) return;
  if (!customBands) customBands = getCurrentBandGains();
  customBands[bandIndex] = gainDb;
  eqBands[bandIndex].gain.setTargetAtTime(gainDb, ctx.currentTime, 0.02);
};

/**
 * Set bass boost separately.
 * @param {number} gainDb
 */
export const setBassBoost = (gainDb) => {
  if (!isInitialized || !bassBoost) return;
  bassBoost.gain.setTargetAtTime(gainDb, ctx.currentTime, 0.05);
};

/**
 * Resume AudioContext (required after user interaction on Chrome).
 */
export const resumeAudio = () => {
  if (ctx?.state === 'suspended') ctx.resume();
};

/**
 * Get current band gains array.
 */
export const getCurrentBandGains = () => {
  return eqBands.map(b => b?.gain?.value || 0);
};

export const getCurrentPreset    = () => currentPreset;
export const isEngineInitialized = () => isInitialized;
