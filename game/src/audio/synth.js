// Procedural Web Audio API sound engine for Solara Bay: Heatline V2.
// Engine RPM, Doppler-shifted police sirens, chopper rotor pulse, gunshots, explosions, synthwave radio.

export function createAudioEngine() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, rotorOsc = null, rotorGain = null;
  let noiseBuffer = null, muted = false, unlocked = false, beatTimer = 0, beatStep = 0;

  function ensureContext() {
    if (muted) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.28; master.connect(ctx.destination);
      const len = ctx.sampleRate; noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0); let s = 1337;
      for (let i = 0; i < len; i += 1) { s = (s * 16807) % 2147483647; data[i] = s / 1073741823.5 - 1; }

      const mkOsc = (type, freq, filterFreq = 0) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = 0;
        if (filterFreq) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq; o.connect(f); f.connect(g); }
        else o.connect(g);
        g.connect(master); o.start(); return [o, g];
      };
      [engineOsc, engineGain] = mkOsc('sawtooth', 55, 260);
      [sirenOsc, sirenGain] = mkOsc('triangle', 660);
      [rotorOsc, rotorGain] = mkOsc('sine', 34);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    unlocked = true; return true;
  }

  function tone(type, f0, f1, vol, dur, delay = 0) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.01);
  }

  function playShot(wId) {
    if (!ensureContext()) return;
    const t = ctx.currentTime, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const dur = wId === 'shotgun' ? 0.22 : wId === 'smg' ? 0.08 : 0.13;
    n.buffer = noiseBuffer; f.type = 'bandpass'; f.frequency.value = wId === 'shotgun' ? 640 : wId === 'carbine' ? 1200 : 1450;
    g.gain.setValueAtTime(wId === 'shotgun' ? 0.65 : 0.38, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur);
    tone('triangle', wId === 'shotgun' ? 140 : 210, 42, 0.35, 0.085);
  }

  function playExplosion() {
    if (!ensureContext()) return;
    const t = ctx.currentTime, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noiseBuffer; f.type = 'lowpass'; f.frequency.setValueAtTime(480, t); f.frequency.exponentialRampToValueAtTime(65, t + 0.65);
    g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.72);
  }

  function playCash() { if (ensureContext()) { tone('sine', 587.33, 0, 0.18, 0.14, 0); tone('sine', 880, 0, 0.18, 0.14, 0.06); } }
  function playMissionClear() { if (ensureContext()) [440, 554.37, 659.25, 880].forEach((f, i) => tone('triangle', f, 0, 0.16, 0.45, i * 0.07)); }

  function update(dt, speed, inVehicle, wanted, time, playing, sirenTel = null, chopper = false) {
    if (!ctx || !unlocked || muted) return;
    const t = ctx.currentTime;
    if (!playing) { engineGain.gain.setTargetAtTime(0, t, 0.08); sirenGain.gain.setTargetAtTime(0, t, 0.08); rotorGain.gain.setTargetAtTime(0, t, 0.08); return; }
    if (inVehicle) { const n = Math.min(1, speed / 560); engineOsc.frequency.setTargetAtTime(52 + n * 124, t, 0.05); engineGain.gain.setTargetAtTime(0.08 + n * 0.1, t, 0.06); }
    else engineGain.gain.setTargetAtTime(0, t, 0.08);

    if (wanted > 0) {
      sirenOsc.frequency.setTargetAtTime((650 + Math.sin(time * 5.4) * 195) * (1 + (sirenTel?.doppler ?? 0) * 0.18), t, 0.03);
      sirenGain.gain.setTargetAtTime(0.02 + (sirenTel?.proximity ?? 0.5) * 0.055, t, 0.07);
    } else sirenGain.gain.setTargetAtTime(0, t, 0.08);

    rotorGain.gain.setTargetAtTime(chopper ? 0.03 + 0.035 * Math.max(0, Math.sin(time * 38)) : 0, t, 0.03);
    if ((beatTimer += dt) >= 0.263) {
      beatTimer -= 0.263; const step = beatStep++;
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime([55, 55, 65.41, 65.41, 49, 49, 61.74, 65.41][step % 8], t);
      f.type = 'lowpass'; f.frequency.setValueAtTime(290, t); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.23);
      if (step % 2 === 1) tone('triangle', [220, 261.63, 329.63, 392, 220, 293.66, 329.63, 440][(step >> 1) % 8], 0, 0.045, 0.16);
    }
  }

  const applyMute = (v) => { muted = Boolean(v); if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.28, ctx.currentTime, 0.03); return muted; };
  return { unlock: ensureContext, setMuted: applyMute, toggleMute: () => applyMute(!muted), isMuted: () => muted, playShot, playExplosion, playCash, playMissionClear, update };
}
