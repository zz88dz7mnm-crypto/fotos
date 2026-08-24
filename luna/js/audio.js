/* audio.js — ambiente opcional: un drone grave con filtro que respira y algunas
 * campanas espaciadas. Se crea recien cuando el usuario lo enciende (los
 * navegadores no permiten audio sin gesto previo). */
(function (global) {
  'use strict';

  var ctx = null, master = null, on = false, timer = null, nodes = [];

  function noiseBuffer(ac) {
    var len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;          // ruido rosado casero
      d[i] = last * 3.2;
    }
    return buf;
  }

  function build() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 3.5;
    filter.connect(master);

    /* eco largo para dar aire */
    var delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    var fb = ctx.createGain(); fb.gain.value = 0.34;
    var wet = ctx.createGain(); wet.gain.value = 0.5;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

    [55, 82.5, 110, 164.8].forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i === 3 ? 'triangle' : 'sine';
      o.frequency.value = f * (1 + (i % 2 ? 0.0015 : -0.0015));
      var g = ctx.createGain();
      g.gain.value = i === 3 ? 0.035 : 0.10 / (i + 1);
      o.connect(g); g.connect(filter);
      o.start();
      nodes.push(o);
    });

    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
    var lfoGain = ctx.createGain(); lfoGain.gain.value = 140;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
    nodes.push(lfo);

    var noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx); noise.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 820; nf.Q.value = 0.6;
    var ng = ctx.createGain(); ng.gain.value = 0.016;
    noise.connect(nf); nf.connect(ng); ng.connect(master);
    noise.start();
    nodes.push(noise);

    var SCALE = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
    function bell() {
      if (!on) return;
      var f = SCALE[(Math.random() * SCALE.length) | 0] * (Math.random() < 0.3 ? 0.5 : 1);
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      var g = ctx.createGain();
      var t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.connect(g);
      if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(delay); pan.connect(master); }
      else { g.connect(delay); g.connect(master); }
      o.start(t); o.stop(t + 3.6);
      timer = setTimeout(bell, 7000 + Math.random() * 11000);
    }
    timer = setTimeout(bell, 2500);
    return true;
  }

  function toggle() {
    if (!ctx && !build()) return false;
    on = !on;
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(on ? 0.17 : 0, t + (on ? 2.2 : 0.9));
    if (on && !timer) timer = setTimeout(function () { }, 0);
    return on;
  }

  global.LunaAudio = { toggle: toggle, get on() { return on; } };
})(typeof window !== 'undefined' ? window : globalThis);
