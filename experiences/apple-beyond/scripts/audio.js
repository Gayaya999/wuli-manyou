/* 原配乐补段与交互音效。音频内嵌，file:// 也能解码；只在用户操作后启动。
   原 MP4 混音保持不动：补曲只在无配乐的分支、互动停留和剪辑接缝出现。 */
(function (root) {
  'use strict';
  function create(video) {
    var ctx, master, musicGain, buffer, decoding, source, noise;
    var enabled = true, active = false, paused = false, offset = 0, startedAt = 0;
    var node = 'welcome', isVideo = false, endAt = 0, target = 0, clicks = 0;
    var branches = ['low', 'high', 'accept', 'relation-question', 'oneway-feedback', 'mutual-feedback'];
    var errorHandler = function () {};
    function level(value, seconds) {
      target = value;
      if (!musicGain) return;
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setTargetAtTime(value, ctx.currentTime, seconds || 0.3);
    }
    function musicTime() {
      return buffer ? (offset + (source ? ctx.currentTime - startedAt : 0)) % buffer.duration : 0;
    }
    function stop(reset) {
      offset = reset ? 0 : musicTime();
      if (source) { source.stop(); source.disconnect(); source = null; }
    }
    function start() {
      if (!ctx || !buffer || !active || paused || source || document.hidden) return;
      source = ctx.createBufferSource();
      source.buffer = buffer; source.loop = true;
      source.connect(musicGain); startedAt = ctx.currentTime;
      source.start(0, offset % buffer.duration);
    }
    function unlock() {
      if (!ctx) {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = enabled ? 1 : 0;
        master.connect(ctx.destination); musicGain = ctx.createGain();
        musicGain.gain.value = target; musicGain.connect(master);
        noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.07), ctx.sampleRate);
        var samples = noise.getChannelData(0), seed = 17;
        for (var i = 0; i < samples.length; i++) { seed = (seed * 16807) % 2147483647; samples[i] = seed / 1073741824 - 1; }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      if (!decoding && !buffer && root.FilmMusicData) {
        var bytes = atob(root.FilmMusicData), data = new Uint8Array(bytes.length);
        for (var i = 0; i < bytes.length; i++) data[i] = bytes.charCodeAt(i);
        decoding = ctx.decodeAudioData(data.buffer).then(function (b) { buffer = b; start(); }).catch(function () {
          decoding = null; errorHandler('配乐未能载入，请刷新后重试');
        });
      }
      start();
    }
    function transition() {
      if (!active || paused || !isVideo) return;
      if (branches.indexOf(node) !== -1) { level(1, 0.24); return; }
      var end = endAt || video.duration;
      if (!Number.isFinite(end)) return;
      var x = Math.max(0, Math.min(1, (video.currentTime - end + 1.4) / 1.4));
      level(x * x * (3 - 2 * x), 0.2);
    }
    video.addEventListener('timeupdate', transition);
    video.addEventListener('playing', transition);
    function enter(next, movie, cutoff) {
      node = next; isVideo = movie; endAt = cutoff || 0;
      active = node !== 'welcome'; paused = false;
      if (!active) { stop(true); level(0); return; }
      if (!movie || branches.indexOf(node) !== -1) level(1, 0.24);
      // 有原配乐的片段等到 playing 再交接，载入期间补曲不中断。
      start();
    }
    function click(kind) {
      unlock();
      if (!enabled || !ctx || document.hidden) return;
      var t = ctx.currentTime, gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      var tap = ctx.createBufferSource(), tone = ctx.createOscillator(), toneGain = ctx.createGain();
      filter.type = 'bandpass'; filter.frequency.value = 1700; filter.Q.value = 0.7;
      tap.buffer = noise; tap.connect(filter); filter.connect(gain); gain.connect(master);
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.15, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
      tone.type = 'sine'; tone.frequency.setValueAtTime(kind === 'confirm' ? 780 : 580, t);
      tone.frequency.exponentialRampToValueAtTime(280, t + 0.07);
      toneGain.gain.setValueAtTime(0.09, t); toneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      tone.connect(toneGain); toneGain.connect(master);
      tap.start(t); tone.start(t); tone.stop(t + 0.1);
      tone.onended = function () { tap.disconnect(); filter.disconnect(); gain.disconnect(); tone.disconnect(); toneGain.disconnect(); };
      clicks++;
    }
    // 捕获阶段先解锁；冒泡阶段读更新后的静音状态，关闭声音的点击不会漏响。
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button, [role="button"], [role="radio"]');
      if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') unlock();
    }, true);
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button, [role="button"], [role="radio"]');
      // 有些按钮点击后会立即禁用，捕获到的真实点击仍需反馈。
      if (b && !b.closest('.sheet') && e.isTrusted) click(b.matches('.primary, #speed-fire, #nb-primary') ? 'confirm' : 'tap');
    });
    return {
      enter: enter, unlock: unlock, click: click,
      setEnabled: function (on) {
        enabled = on; video.muted = !on;
        if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.015);
      },
      pause: function () { paused = true; stop(false); },
      resume: function () { paused = false; unlock(); start(); },
      onError: function (fn) { errorHandler = fn; },
      inspect: function () { return { enabled: enabled, active: active, paused: paused, playing: !!source && ctx.state === 'running', time: musicTime(), duration: buffer ? buffer.duration : 0, level: target, clicks: clicks, node: node, context: ctx ? ctx.state : 'locked' }; }
    };
  }
  root.FilmAudio = { create: create };
})(window);
