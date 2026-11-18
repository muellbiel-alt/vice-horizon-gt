// Procedural Web Audio API synthesizer for Solara Bay: Heatline.
// Generates engine RPM hum, drift tire screech, dual-tone police sirens, gunshots, explosions,
// cash chimes, and an atmospheric sunset synthwave groove with instant Mute toggle.

export function createAudioEngine() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuffer = null;
  let muted = false;
  let unlocked = false;
  let beatTimer = 0;
  let beatStep = 0;

  function ensureContext() {
    if (muted) return false;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);

      // Shared white-noise buffer for gunshots, explosions, and tire screech
      const len = ctx.sampleRate;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let seed = 1337;
      for (let i = 0; i < len; i += 1) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 1073741823.5) - 1;
      }

      // Continuous engine hum
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 260;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engFilter);
      engFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // Continuous police siren oscillator
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    unlocked = true;
    return true;
  }

  function unlock() {
    ensureContext();
  }

  function setMuted(next) {
    muted = Boolean(next);
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : 0.28, ctx.currentTime, 0.03);
    }
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function playShot(weaponId) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = weaponId === 'shotgun' ? 640 : weaponId === 'carbine' ? 1200 : 1450;

    const gain = ctx.createGain();
    const dur = weaponId === 'shotgun' ? 0.22 : weaponId === 'smg' ? 0.08 : 0.13;
    gain.gain.setValueAtTime(weaponId === 'shotgun' ? 0.65 : 0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + dur);

    // Punchy low thump
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(weaponId === 'shotgun' ? 140 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.35, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(og);
    og.connect(master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  function playExplosion() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.exponentialRampToValueAtTime(65, now + 0.65);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + 0.72);
  }

  function playCash() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const notes = [587.33, 880];
    for (let i = 0; i < notes.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], now + i * 0.06);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.14);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.15);
    }
  }

  function playMissionClear() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880];
    for (let i = 0; i < chord.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(chord[i], now + i * 0.07);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.45);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.46);
    }
  }

  function triggerSynthBeat(step) {
    if (!ctx || muted || !unlocked) return;
    const now = ctx.currentTime;
    const bassNotes = [55, 55, 65.41, 65.41, 49, 49, 61.74, 65.41];
    const arpNotes = [220, 261.63, 329.63, 392, 220, 293.66, 329.63, 440];

    // Warm synthwave bass pulse
    const bass = ctx.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(bassNotes[step % bassNotes.length], now);
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.setValueAtTime(280, now);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.09, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    bass.connect(bf);
    bf.connect(bg);
    bg.connect(master);
    bass.start(now);
    bass.stop(now + 0.23);

    // Subtle arpeggio on alternating steps
    if (step % 2 === 1) {
      const arp = ctx.createOscillator();
      arp.type = 'triangle';
      arp.frequency.setValueAtTime(arpNotes[(step >> 1) % arpNotes.length], now);
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.045, now);
      ag.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      arp.connect(ag);
      ag.connect(master);
      arp.start(now);
      arp.stop(now + 0.17);
    }
  }

  function update(dt, playerSpeed, inVehicle, wantedLevel, time, isPlaying) {
    if (!ctx || !unlocked || muted) return;
    const now = ctx.currentTime;

    if (!isPlaying) {
      engineGain?.gain.setTargetAtTime(0, now, 0.08);
      sirenGain?.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Engine pitch & volume
    if (inVehicle) {
      const norm = Math.min(1, playerSpeed / 560);
      engineOsc.frequency.setTargetAtTime(52 + norm * 118, now, 0.05);
      engineGain.gain.setTargetAtTime(0.08 + norm * 0.1, now, 0.06);
    } else {
      engineGain.gain.setTargetAtTime(0, now, 0.08);
    }

    // Wailing dual-tone siren when wanted > 0
    if (wantedLevel > 0) {
      const wail = 640 + Math.sin(time * 5.2) * 190;
      sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      sirenGain.gain.setTargetAtTime(0.045, now, 0.08);
    } else {
      sirenGain.gain.setTargetAtTime(0, now, 0.08);
    }

    // Sunset synthwave beat at 114 BPM (~0.263s per 8th note)
    beatTimer += dt;
    if (beatTimer >= 0.263) {
      beatTimer -= 0.263;
      triggerSynthBeat(beatStep++);
    }
  }

  return {
    unlock,
    setMuted,
    toggleMute,
    isMuted,
    playShot,
    playExplosion,
    playCash,
    playMissionClear,
    update,
  };
}
