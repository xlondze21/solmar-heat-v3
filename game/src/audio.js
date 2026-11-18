// Synthesized sound only: one WebAudio context, oscillators and filtered noise, nothing
// loaded from a file. Everything is lazy (the context starts on the first user gesture) and
// guarded, so a browser that refuses audio never breaks the game.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let radioNodes = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound is garnish: never let it throw.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(gain).connect(master);
      src.start(t);
    } catch {
      // Sound is garnish: never let it throw.
    }
  }

  return {
    resume,
    punch() {
      noise(0.09, 0.35, 500);
    },
    shot() {
      noise(0.16, 0.5, 2600);
      blip(160, 0.08, 'square', 0.18, 60);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.22);
      blip(990, 0.14, 'sine', 0.2);
    },
    cash() {
      blip(880, 0.08, 'triangle', 0.22);
      blip(1174, 0.08, 'triangle', 0.22);
      blip(1568, 0.2, 'triangle', 0.24);
    },
    denied() {
      blip(180, 0.16, 'sawtooth', 0.2, 120);
    },
    busted() {
      blip(440, 0.3, 'sawtooth', 0.25, 110);
      blip(220, 0.5, 'sawtooth', 0.25, 55);
    },
    explosion() {
      noise(0.7, 0.6, 900);
      blip(90, 0.6, 'sine', 0.4, 30);
    },
    /** A continuous engine tone whose pitch follows `speed` (0..1); 0 silences it. */
    engine(speed) {
      if (!ensure()) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 55;
          engineGain.gain.value = 0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          engineOsc.connect(filter).connect(engineGain).connect(master);
          engineOsc.start();
        }
        const t = ctx.currentTime;
        engineGain.gain.setTargetAtTime(speed > 0.03 ? 0.05 + speed * 0.05 : 0, t, 0.08);
        engineOsc.frequency.setTargetAtTime(55 + speed * 130, t, 0.08);
      } catch {
        // Sound is garnish.
      }
    },
    /** Start the radio sequencer; `stepFn` is called with the step index each 16th note. */
    radioStart(stepFn, bpm) {
      this.radioStop();
      if (!ensure()) return;
      try {
        const stepDur = 60 / bpm / 4;
        let step = 0;
        const timer = window.setInterval(() => {
          if (!ctx || ctx.state !== 'running') return;
          stepFn(step);
          step += 1;
        }, stepDur * 1000);
        radioNodes = { timer };
      } catch {
        // Sound is garnish.
      }
    },
    radioStop() {
      if (radioNodes) {
        window.clearInterval(radioNodes.timer);
        radioNodes = null;
      }
    },
    /** One synth note for the radio sequencer. */
    note(freq, dur, type, vol) {
      blip(freq, dur, type || 'square', vol || 0.12);
    },
  };
}
