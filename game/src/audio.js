// Sound for Velora Bay, all synthesised with WebAudio — no audio files.
// Three radio stations (synthwave, funk, chill) play looping chord patterns,
// plus an engine hum tied to speed, a two-tone police siren, and one-shot
// effects for gunshots, punches, pickups and mission jingles. Everything is
// guarded so the game still runs with no audio device or before any gesture.

export function createAudio() {
  const audio = {
    ctx: null, muted: false, station: 0, musicTimer: 0,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    stations: [
      { name: 'BAY FM 88.1 — Sunset Drive', bpm: 96, bass: [55, 55, 65.4, 49], lead: [220, 261.6, 329.6, 392] },
      { name: 'FUNK 101 — Coral Groove', bpm: 112, bass: [41.2, 55, 49, 61.7], lead: [277.2, 311.1, 370, 415.3] },
      { name: 'CHILL 93 — Palm Waves', bpm: 72, bass: [65.4, 58.3, 49, 55], lead: [196, 220, 246.9, 293.7] },
    ],
    step: 0,
  };

  audio.ensure = function ensureAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      // Engine hum: a sawtooth whose pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc.start();
      // Police siren: two alternating tones.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.ctx.destination);
      audio.sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  };

  audio.setMuted = function setMuted(m) {
    audio.muted = m;
    if (audio.ctx) audio.ctx.suspend().catch(() => {});
    if (!m && audio.ctx) audio.ctx.resume().catch(() => {});
  };

  audio.nextStation = function nextStation() {
    audio.station = (audio.station + 1) % audio.stations.length;
    audio.step = 0;
    return audio.stations[audio.station].name;
  };

  audio.stationName = function stationName() {
    return audio.stations[audio.station].name;
  };

  function tone(freq, dur, type, vol, when = 0) {
    if (!audio.ctx || audio.muted) return;
    try {
      const t0 = audio.ctx.currentTime + when;
      const osc = audio.ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(audio.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!audio.ctx || audio.muted) return;
    try {
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const g = audio.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter); filter.connect(g); g.connect(audio.ctx.destination);
      src.start();
    } catch { /* audio is best-effort */ }
  }

  audio.playShot = function playShot() { noiseBurst(0.14, 0.5, 2400); tone(180, 0.08, 'square', 0.12); };
  audio.playPunch = function playPunch() { noiseBurst(0.09, 0.3, 500); };
  audio.playBlip = function playBlip(freq) { tone(freq || 440, 0.12, 'sine', 0.18); };
  audio.playMissionStart = function playMissionStart() {
    tone(392, 0.15, 'triangle', 0.2); tone(523.3, 0.15, 'triangle', 0.2, 0.13); tone(659.3, 0.3, 'triangle', 0.2, 0.26);
  };
  audio.playMissionComplete = function playMissionComplete() {
    tone(523.3, 0.16, 'triangle', 0.22); tone(659.3, 0.16, 'triangle', 0.22, 0.14);
    tone(783.99, 0.16, 'triangle', 0.22, 0.28); tone(1046.5, 0.4, 'triangle', 0.24, 0.42);
  };

  // Called every frame: engine pitch, siren wail, and the radio sequencer.
  audio.update = function updateAudio(dt, game) {
    if (!audio.ctx || audio.muted) return;
    const speed = game.playerCar ? Math.abs(game.playerCar.speed) : 0;
    if (audio.engineGain) {
      audio.engineGain.gain.value = game.playerCar ? 0.05 + speed * 0.002 : 0.012;
      audio.engineOsc.frequency.value = 50 + speed * 4.2;
    }
    if (audio.sirenGain) {
      const on = game.police && game.police.sirenOn;
      audio.sirenGain.gain.value = on ? 0.045 : 0;
      if (on) audio.sirenOsc.frequency.value = 660 + Math.sin(game.time * 5) * 180;
    }
    // Radio: one 8th-note step per beat division, bass + sparse lead.
    const st = audio.stations[audio.station];
    const stepDur = 60 / st.bpm / 2;
    audio.musicTimer += dt;
    while (audio.musicTimer >= stepDur) {
      audio.musicTimer -= stepDur;
      const s = audio.step++;
      if (s % 2 === 0) tone(st.bass[(s / 2) % st.bass.length], stepDur * 1.8, 'triangle', 0.11);
      if (s % 8 === 4) tone(st.lead[(s / 8) % st.lead.length], stepDur * 2.4, 'sine', 0.07);
      if (s % 16 === 14) tone(st.lead[(s / 16 + 1) % st.lead.length] * 2, stepDur, 'sine', 0.05);
    }
  };

  return audio;
}
