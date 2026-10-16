/* 整片播放器：把剧情状态（story.js）、播放会话（media.js）、热点与点击反馈（fx.js）、手稿（notebook.js）接在一起。
   规则：剧情只由“当前片段真实播完”或“玩家明确操作”推进；每次推进后保存语义状态。 */
(function () {
  "use strict";
  var C = window.FilmConfig, Story = window.FilmStory, Media = window.FilmMedia, FX = window.FilmFX;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function later(ms, fn) { return setTimeout(fn, FX.reduced() ? 0 : ms); }

  var scene = $("#scene"), still = $("#still"), video = $("#clip"), freeze = $("#freeze");
  var sound = window.FilmAudio.create(video);
  var fxLayer = $(".fx-layer", scene), live = $("#live"), toast = $("#toast");
  var SAVE = "apple-beyond-save-v1", PREFS = "apple-beyond-prefs-v1";
  var state = Story.initial();
  var currentClip = null;
  var paused = false;

  var HOLD_STILL = { welcome: "cover", speed: "speed", retry: "speed", hypothesis: "hypothesis", notebook: "desk", reciprocity: "reciprocity", summary: "desk" };
  var SCENE_OF = { welcome: "welcome", speed: "speed", retry: "speed", hypothesis: "dialogue", notebook: "notebook", reciprocity: "reciprocity", summary: "summary" };
  var END_AT = { research: 11.15 }; // 停在地球—立方体图之前，手稿接在这里
  var AMBIENCE = {
    welcome: { motes: [[80, 120, 520, 380]], n: 12 },
    speed: { motes: [[40, 90, 520, 360]], n: 9 },
    retry: { motes: [[40, 90, 520, 360]], n: 9 },
    hypothesis: { glow: [1252, 262, 110], motes: [[1080, 120, 1240, 420]], n: 6 },
    notebook: { motes: [[0, 120, 600, 420]], n: 14 },
    reciprocity: { motes: [[0, 80, 520, 420]], n: 10 },
    summary: { motes: [[0, 120, 600, 420]], n: 14 }
  };

  /* ---------- 存档与偏好 ---------- */
  var warnedSave = false;
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify(state)); }
    catch (e) { if (!warnedSave) { warnedSave = true; showToast("本次进度暂时无法保存"); } }
  }
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  function prefs(update) {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(PREFS) || "{}") || {}; } catch (e) {}
    if (update) { for (var k in update) p[k] = update[k]; try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch (e) {} }
    return p;
  }
  var toastTimer = 0;
  function showToast(text, ms) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, ms || 2600);
  }

  /* ---------- 推进 ---------- */
  function dispatch(action) {
    var prev = state.node;
    var next = Story.reduce(state, action);
    if (next === state) return false;
    state = next;
    save();
    if (state.node !== prev) enter();
    return true;
  }

  function enter() {
    var node = state.node;
    sound.enter(node, Story.isVideo(node), END_AT[node]);
    scene.setAttribute("data-node", node);
    if (Story.isVideo(node)) playNode(node);
    else showHold(node);
  }

  /* 只显示属于当前节点的界面组与热点 */
  function showGroupsFor(node) {
    $$("[data-for]", scene).forEach(function (el) {
      var on = node && (" " + el.getAttribute("data-for") + " ").indexOf(" " + node + " ") !== -1;
      el.hidden = !on;
    });
  }

  function setAmbience(node) {
    var amb = $(".ambience", scene);
    var cfg = AMBIENCE[node];
    var html = "";
    if (cfg) {
      if (cfg.glow) html += '<i class="glow" style="--x:' + cfg.glow[0] + ';--y:' + cfg.glow[1] + ';--r:' + cfg.glow[2] + '"></i>';
      (cfg.motes || []).forEach(function (box, b) {
        for (var i = 0; i < cfg.n; i++) {
          var r = function (k) { var x = Math.sin((i + 1) * 91.7 + b * 13 + k * 7.3) * 43758.5453; return x - Math.floor(x); };
          html += '<i class="mote" style="--x:' + Math.round(box[0] + r(1) * (box[2] - box[0])) + ';--y:' + Math.round(box[1] + r(2) * (box[3] - box[1])) +
            ';--s:' + (1.5 + r(3) * 2.5).toFixed(1) + ';--d:' + (5 + r(4) * 6).toFixed(1) + 's;--dl:-' + (r(5) * 6).toFixed(1) + 's;--mx:' + Math.round(r(6) * 60 - 20) + ';--my:' + Math.round(r(7) * 40 - 30) + '"></i>';
        }
      });
    }
    amb.innerHTML = html;
  }

  /* 把当前视频最后一帧冻结在画布上，换片时不闪回旧画面（只绘制、不读取像素，file:// 下也可用） */
  function freezeFrame() {
    if (video.hidden || !video.videoWidth) return;
    try {
      freeze.getContext("2d").drawImage(video, 0, 0, 1280, 720);
      freeze.hidden = false;
    } catch (e) { /* 忽略 */ }
  }

  function playNode(node) {
    closeMenu(true);
    sound.enter(node, true, END_AT[node]);
    freezeFrame();
    scene.setAttribute("data-scene", "video");
    showGroupsFor(null);
    setAmbience(null);
    currentClip = node;
    paused = false;
    var preShown = false;
    Media.play(scene, node, {
      endAt: END_AT[node],
      onReveal: function () { freeze.hidden = true; },
      onTime: function (t) {
        // 开场最后半秒，镜头切到停留构图时，小球热点已在影片里亮起
        if (node === "opening" && !preShown && t >= 79.55) {
          preShown = true;
          var ball = $("#sp-ball");
          ball.hidden = false;
          FX.popIn(ball, { from: 0.3, rotate: 0, ms: 420 });
        }
      },
      onEnded: function () { dispatch({ type: "MEDIA_ENDED", clip: node }); },
      onError: function () { freeze.hidden = true; }
    });
    announce("");
  }

  function showHold(node) {
    currentClip = null;
    var img = "assets/stills/" + HOLD_STILL[node] + ".jpg";
    if (still.getAttribute("src") !== img) still.setAttribute("src", img);
    scene.setAttribute("data-scene", SCENE_OF[node]);
    showGroupsFor(node);
    setAmbience(node);
    freeze.hidden = true;
    if (!video.hidden) Media.fadeOut(scene);
    var init = HOLDS[node];
    if (init) init();
  }

  function announce(text) { live.textContent = text; }

  /* ================= 片头 ================= */
  var btnStart = $("#btn-start"), btnResume = $("#btn-resume");
  function welcomeEnter() {
    var saved = loadSave();
    var v = saved ? Story.validate(saved) : null;
    btnResume.hidden = !(v && v.state.node !== "welcome");
    later(100, function () { btnStart.focus({ preventScroll: true }); });
  }
  btnStart.addEventListener("click", function () {
    FX.ripple(fxLayer, 300, 600, { size: 1.2 });
    state = Story.initial();
    dispatch({ type: "START" });
  });
  btnResume.addEventListener("click", function () {
    var v = Story.validate(loadSave());
    state = v.state;
    if (!v.ok) showToast("已回到可继续的位置");
    save();
    enter();
  });

  /* ================= 三档速度 ================= */
  var ball = $("#sp-ball"), dial = $("#sp-dial"), medals = $$(".medal", scene);
  var launch = $(".launch", scene), lBody = $(".launch-body", scene), lGlow = $(".launch-glow", scene), lTicks = $(".launch-ticks", scene);
  var fire = $("#speed-fire"), result = $("#sp-result"), retry = $("#sp-retry");
  var sp = { open: false, sel: null, busy: false };
  var LEN = [90, 150, 215];

  function setArrow(i) {
    var x1 = 850, y = 482, L = LEN[i], w = 7 + i * 2.5, head = 26 + i * 4, hw = w * 1.9, x2 = x1 + L, bx = x2 - head;
    var d = "M" + x1 + " " + (y - w * 0.35) + " L" + bx + " " + (y - w) + " L" + bx + " " + (y - hw) + " L" + x2 + " " + y +
      " L" + bx + " " + (y + hw) + " L" + bx + " " + (y + w) + " L" + x1 + " " + (y + w * 0.35) + " Z";
    lBody.setAttribute("d", d);
    lGlow.setAttribute("d", d);
    var t = "";
    for (var k = 0; k <= i; k++) t += '<path d="M' + (772 - k * 16) + " " + (472 + k * 6) + " L" + (792 - k * 16) + " " + (472 + k * 6) + '"/>';
    lTicks.innerHTML = t;
  }
  function speedRender() {
    var speedMode = state.node === "speed" && !sp.busy;
    scene.classList.toggle("is-dialing", sp.open && speedMode);
    dial.classList.toggle("is-open", sp.open && speedMode);
    ball.hidden = state.node !== "speed";
    ball.setAttribute("aria-expanded", String(sp.open));
    ball.setAttribute("aria-label", sp.open ? "小球（速度盘已展开）" : "小球：选择发射速度");
    ball.classList.toggle("is-hinting", !sp.open && speedMode);
    medals.forEach(function (m, i) {
      m.setAttribute("aria-checked", String(sp.sel === i));
      m.classList.toggle("is-tried", state.tried[i] && i !== 1);
      $(".medal-tried", m).setAttribute("data-outcome", ["落", "", "飞"][i]);
      m.setAttribute("aria-label", C.copy.speed.stopNames[i] + (state.tried[i] && i !== 1 ? (i === 0 ? "，试过：落回地面" : "，试过：飞离") : ""));
      m.tabIndex = (sp.sel === null ? i === 0 : sp.sel === i) ? 0 : -1;
    });
    launch.classList.toggle("is-on", sp.sel !== null && speedMode);
    if (sp.sel !== null) setArrow(sp.sel);
    fire.disabled = sp.sel === null || !speedMode;
    fire.classList.toggle("is-ready", !fire.disabled);
    fire.parentNode.hidden = state.node !== "speed";
    result.hidden = state.node !== "retry";
  }
  function openDial() {
    if (state.node !== "speed" || sp.open) return;
    sp.open = true;
    speedRender();
    FX.ripple(fxLayer, 814, 482, { size: 0.9 });
    later(260, function () { medals[sp.sel === null ? 0 : sp.sel].focus({ preventScroll: true }); });
  }
  function selectSpeed(i) {
    if (state.node !== "speed" || sp.busy) return;
    sp.open = true;
    var changed = sp.sel !== i;
    sp.sel = i;
    speedRender();
    if (changed) {
      launch.classList.remove("is-on"); void launch.offsetWidth; launch.classList.add("is-on");
      var c = medals[i].style;
      FX.ripple(fxLayer, +c.getPropertyValue("--x"), +c.getPropertyValue("--y"), { size: 0.55, drops: 6 });
    }
  }
  ball.addEventListener("click", openDial);
  medals.forEach(function (m, i) { m.addEventListener("click", function () { selectSpeed(i); m.focus({ preventScroll: true }); }); });
  dial.addEventListener("keydown", function (e) {
    var focused = medals.indexOf(document.activeElement);
    var cur = sp.sel === null ? focused : sp.sel, i = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") i = Math.min(2, cur + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") i = Math.max(0, cur === -1 ? 0 : cur - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = 2;
    if (i === null) return;
    e.preventDefault();
    selectSpeed(i);
    sound.click("tap");
    medals[i].focus({ preventScroll: true });
  });
  fire.addEventListener("click", function () {
    if (state.node !== "speed" || sp.sel === null || sp.busy) return;
    var level = sp.sel;
    sp.busy = true;
    fire.classList.add("is-firing");
    launch.classList.add("is-fired");
    FX.ripple(fxLayer, 814, 482, { size: 1.4, drops: 8, lines: true });
    speedRender();
    launch.classList.add("is-on");
    later(420, function () {
      launch.classList.remove("is-on", "is-fired");
      fire.classList.remove("is-firing");
      sp = { open: false, sel: null, busy: false };
      dispatch({ type: "LAUNCH", level: level });
    });
  });

  var RESULT = {
    0: { d: "M18 44 Q78 30 130 82", bx: 130, by: 80, tag: "落地", sr: C.copy.speed.low, burst: [[130, 86, 0]] },
    2: { d: "M18 44 Q120 40 236 2", bx: 232, by: 6, tag: "飞走", sr: C.copy.speed.high, burst: [[214, 18, 1], [196, 30, 1]] }
  };
  function speedEnter() {
    sp = { open: false, sel: null, busy: false };
    speedRender();
    if (!FX.reduced()) FX.popIn(ball, { from: 0.4, rotate: 0, ms: 420 });
    announce("调整速度，让小球绕过地面。点小球选择档位。");
    later(120, function () { ball.focus({ preventScroll: true }); });
  }
  function retryEnter() {
    sp = { open: false, sel: null, busy: false };
    speedRender();
    var r = RESULT[state.lastSpeed] || RESULT[0];
    $(".result-trail", result).setAttribute("d", r.d);
    var bl = $(".result-ball", result);
    bl.setAttribute("cx", r.bx); bl.setAttribute("cy", r.by);
    $(".result-burst", result).innerHTML = r.burst.map(function (b) {
      if (!b[2]) return '<path d="M' + (b[0] - 14) + " " + b[1] + " l-8 -6 M" + (b[0] + 14) + " " + b[1] + " l8 -6 M" + b[0] + " " + (b[1] - 12) + ' l0 -8"/>';
      return '<path d="M' + (b[0] - 5) + " " + b[1] + " h10 M" + b[0] + " " + (b[1] - 5) + ' v10"/>';
    }).join("");
    $(".result-tag", result).textContent = r.tag;
    $("#sp-result-sr").textContent = r.sr;
    FX.popIn(result, { from: 0.7, rotate: -8, ms: 480 });
    FX.drawIn([$(".result-trail", result)], 900, 200);
    if (bl.animate && !FX.reduced()) {
      bl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 950, fill: "backwards" });
    }
    announce(r.sr);
    later(200, function () { retry.focus({ preventScroll: true }); });
  }
  retry.addEventListener("click", function () {
    FX.ripple(fxLayer, 660, 200, { size: 0.7, drops: 6 });
    if (dispatch({ type: "RETRY" })) openDial();
  });

  /* ================= 两段对白选择（共用纸条组件） ================= */
  function bubbleChoice(groupSel, actionType, target, onIntro) {
    var group = $(groupSel), bubbles = $$(".bubble", group), busy = false;
    function reset() {
      busy = false;
      group.classList.remove("is-locked");
      scene.classList.remove("is-answered");
      bubbles.forEach(function (b) {
        b.classList.remove("is-chosen"); b.disabled = false; b.style.visibility = "";
        if (b.getAnimations) b.getAnimations().forEach(function (a) { a.cancel(); });
      });
    }
    function intro() {
      reset();
      bubbles.forEach(function (b, i) {
        FX.popIn(b, { from: 0.5, rotate: -10, ms: 460, delay: 260 + i * 170 });
        FX.drawIn($$(".ba-arrow", b), 520, 560 + i * 170);
      });
      if (onIntro) onIntro();
      later(300, function () { bubbles[0].focus({ preventScroll: true }); });
    }
    bubbles.forEach(function (b) {
      b.addEventListener("mouseenter", function () { if (!busy) FX.drawIn($$(".ba-arrow", b), 420); });
      b.addEventListener("click", function () {
        if (busy) return;
        busy = true;
        var r = b.getBoundingClientRect(), st = $(".stage", scene).getBoundingClientRect(), u = st.width / 1280;
        FX.ripple(fxLayer, (r.left + r.width / 2 - st.left) / u, (r.top + r.height / 2 - st.top) / u, { size: 1.1 });
        b.classList.add("is-chosen");
        group.classList.add("is-locked");
        scene.classList.add("is-answered");
        bubbles.forEach(function (o) { if (o !== b) o.disabled = true; });
        later(260, function () {
          FX.flyTo(b, target[0], target[1], {
            scale: 0.12, rotate: -10, ms: 560, done: function () {
              b.style.visibility = "hidden";
              FX.ripple(fxLayer, target[0], target[1], { size: 1.2, drops: 10 });
              later(300, function () { dispatch({ type: actionType, value: b.getAttribute("data-value") }); });
            }
          });
        });
      });
    });
    return { intro: intro, reset: reset };
  }
  var hyp = bubbleChoice("#hyp-bubbles", "HYPOTHESIS", [760, 584]);
  var rec = bubbleChoice("#rec-bubbles", "RECIPROCITY", [836, 500]);

  /* ================= 手稿 ================= */
  var nbWrap = $(".sheet-wrap", scene);
  var nb = window.FilmNotebook.create(scene, {
    hypothesis: "constant",
    onInteract: function () { sound.click("tap"); },
    onNote: function () {},
    onProgress: function (S) {
      dispatch({ type: "NOTEBOOK_PROGRESS", facts: { aligned: S.aligned, inspected: S.inspected, current: S.current, revision: S.revision, verifiedRevision: S.verifiedRevision, mismatchAcknowledged: S.mismatchSeen } });
    },
    onComplete: function (S) {
      later(900, function () {
        dispatch({ type: "NOTEBOOK_DONE", facts: { aligned: S.aligned, inspected: S.inspected, current: S.current, revision: S.revision, verifiedRevision: S.verifiedRevision, mismatchAcknowledged: S.mismatchSeen } });
      });
    }
  });
  function notebookEnter() {
    nb.reset(state.originalHypothesis || "constant");
    nbWrap.classList.add("is-entering");
    void nbWrap.offsetWidth;
    requestAnimationFrame(function () { nbWrap.classList.remove("is-entering"); });
    announce("手稿：对齐两组十字，再逐处检视。");
  }

  /* ================= 结尾 ================= */
  var spots = $$(".hs[data-clue]", scene), slots = $$(".slot", scene);
  var clue = $("#sum-clue"), art = $(".clue-art", clue), sumEnd = $("#sum-end");
  var record = $("#sum-record"), exits = $("#sum-exits"), confirmBox = $("#sum-confirm"), restart = $("#sum-restart");
  var sumTask = $("#sum-task");
  var found = [false, false, false], sumBusy = false;
  var CLUE_AT = [{ x: 720, y: 108 }, { x: 760, y: 226 }, { x: 990, y: 214 }];
  /* 线索卡：纸上的墨线速写（与影片示意图同一画法：平涂 + 墨线） */
  var ARTS = [
    '<ellipse cx="100" cy="58" rx="74" ry="32" fill="none" stroke="#5a5043" stroke-width="1.6" stroke-dasharray="4 6"/>' +
    '<circle cx="100" cy="58" r="20" fill="#4f88ab" stroke="#2a241d" stroke-width="2.4"/><circle cx="168" cy="44" r="7" fill="#ece4cb" stroke="#2a241d" stroke-width="2"/>' +
    '<path class="ca-ink" pathLength="1" d="M168 44 L188 24 M181 24 L188 24 L188 31"/><path class="ca-red" pathLength="1" d="M162 47 L136 54 M142 49 L136 54 L142 59"/>',
    '<path d="M14 10 A60 60 0 0 1 14 110" fill="#4f88ab" stroke="#2a241d" stroke-width="2.4"/>' +
    '<circle cx="74" cy="40" r="7" fill="#ece4cb" stroke="#2a241d" stroke-width="2"/><path class="ca-red" pathLength="1" d="M66 40 L30 40 M37 34 L30 40 L37 46"/>' +
    '<circle cx="172" cy="80" r="7" fill="#ece4cb" stroke="#2a241d" stroke-width="2"/><path class="ca-red" pathLength="1" d="M164 80 L150 80 M155 75 L150 80 L155 85"/>',
    '<circle cx="44" cy="60" r="34" fill="#4f88ab" stroke="#2a241d" stroke-width="2.4"/>' +
    '<circle cx="162" cy="60" r="16" fill="#c0392b" stroke="#2a241d" stroke-width="2.4"/><path class="ca-red" pathLength="1" d="M82 48 L112 48 M106 43 L112 48 L106 53"/>' +
    '<path class="ca-red" pathLength="1" d="M142 72 L112 72 M118 67 L112 72 L118 77"/>'
  ];
  function sumRenderEnd(animate) {
    var all = found.every(Boolean);
    sumEnd.hidden = !all;
    sumTask.textContent = all ? "三条发现写进了手稿" : "点亮桌上的三处线索";
    if (all) record.textContent = Story.recordLine(state);
    if (all && animate) {
      FX.popIn(record, { from: 0.9, rotate: 0, ms: 380, delay: 200 });
      FX.popIn(exits, { from: 0.9, rotate: 0, ms: 380, delay: 320 });
      later(400, function () { restart.focus({ preventScroll: true }); });
      announce("三条发现：向前运动，也在下落。距离变远，吸引减弱。地球与苹果，相互吸引。" + record.textContent);
    }
  }
  function markFound(i, animate) {
    found[i] = true;
    slots[i].classList.add("is-found");
    spots[i].classList.add("is-done");
    spots[i].setAttribute("aria-label", $(".hs-tag", spots[i]).textContent + "（已点亮）");
    if (animate) FX.popIn($(".slot-mark", slots[i]), { from: 1.6, rotate: -12, ms: 380 });
  }
  function reveal(i) {
    if (sumBusy || found[i] || state.node !== "summary") return;
    sumBusy = true;
    var c = spots[i].style;
    FX.ripple(fxLayer, +c.getPropertyValue("--x"), +c.getPropertyValue("--y"), { size: 1 });
    var narrow = $(".stage", scene).getBoundingClientRect().width < 600;
    if (narrow || FX.reduced()) {
      markFound(i, true); sumBusy = false;
      if (found.every(Boolean)) later(300, function () { sumRenderEnd(true); });
      return;
    }
    clue.style.setProperty("--x", CLUE_AT[i].x);
    clue.style.setProperty("--y", CLUE_AT[i].y);
    art.innerHTML = ARTS[i];
    clue.hidden = false;
    FX.popIn(clue, { from: 0.4, rotate: -6, ms: 420 });
    FX.drawIn($$(".ca-ink, .ca-red", art), 640, 160);
    later(1300, function () {
      var mk = $(".slot-mark", slots[i]).getBoundingClientRect(), st = $(".stage", scene).getBoundingClientRect(), u = st.width / 1280;
      var tx = (mk.left + mk.width / 2 - st.left) / u, ty = (mk.top + mk.height / 2 - st.top) / u;
      FX.flyTo(clue, tx, ty, {
        scale: 0.08, rotate: -12, ms: 560, done: function () {
          clue.hidden = true;
          if (clue.getAnimations) clue.getAnimations().forEach(function (a) { a.cancel(); });
          FX.ripple(fxLayer, tx, ty, { size: 0.6, drops: 7 });
          markFound(i, true);
          sumBusy = false;
          if (found.every(Boolean)) later(900, function () { sumRenderEnd(true); });
        }
      });
    });
  }
  spots.forEach(function (s, i) { s.addEventListener("click", function () { reveal(i); }); });
  function summaryEnter() {
    found = [false, false, false]; sumBusy = false;
    clue.hidden = true;
    confirmBox.hidden = true; exits.hidden = false;
    slots.forEach(function (sl) { sl.classList.remove("is-found"); });
    spots.forEach(function (sp, i) {
      sp.classList.remove("is-done");
      sp.setAttribute("aria-label", $(".hs-tag", sp).textContent);
      later(300 + i * 260, function () {
        if (FX.reduced()) return;
        FX.popIn(sp, { from: 0.3, rotate: 0, ms: 420 });
        var st = sp.style;
        FX.ripple(fxLayer, +st.getPropertyValue("--x"), +st.getPropertyValue("--y"), { size: 0.7, drops: 0 });
      });
    });
    sumRenderEnd(false);
    announce("点亮桌上的三处线索：地球仪、手稿、苹果。");
    later(400, function () { spots[0].focus({ preventScroll: true }); });
  }
  restart.addEventListener("click", function () { exits.hidden = true; confirmBox.hidden = false; $("#sum-yes").focus(); });
  $("#sum-no").addEventListener("click", function () { confirmBox.hidden = true; exits.hidden = false; restart.focus(); });
  $("#sum-yes").addEventListener("click", function () { clearSave(); dispatch({ type: "RESTART" }); });
  $("#sum-back").addEventListener("click", goHome);

  function goHome() {
    var ret = safeReturn();
    if (ret) { location.href = ret; return; }
    Media.stop(scene);
    state = Story.reduce(state, { type: "HOME" });
    enter();
  }
  /* 主站接入：只接受同源 http(s) 返回地址 */
  function safeReturn() {
    try {
      var r = new URLSearchParams(location.search).get("return");
      if (!r || !/^https?:$/.test(location.protocol)) return null;
      var u = new URL(r, location.href);
      return u.origin === location.origin ? u.href : null;
    } catch (e) { return null; }
  }

  var HOLDS = {
    welcome: welcomeEnter,
    speed: speedEnter,
    retry: retryEnter,
    hypothesis: function () { hyp.intro(); announce("牛顿问：相隔这么远，吸引还会一样强吗？请选择一个回答。"); },
    notebook: notebookEnter,
    reciprocity: function () { rec.intro(); announce("牛顿问：苹果落下来时，地球会不会也受到它的影响？请选择一个回答。"); },
    summary: summaryEnter
  };

  /* ================= 播放器工具与菜单 ================= */
  var chrome = $("#chrome"), btnMenu = $("#btn-menu"), menu = $("#menu");
  var mPlay = $("#m-play"), mReplay = $("#m-replay"), mSound = $("#m-sound"), mMotion = $("#m-motion"), mRestart = $("#m-restart"), mHome = $("#m-home");
  var idleTimer = 0, restartArmed = 0;
  function wake() {
    chrome.classList.remove("is-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { if (menu.hidden && !paused) chrome.classList.add("is-idle"); }, 2500);
  }
  ["pointermove", "pointerdown", "keydown", "touchstart"].forEach(function (e) { document.addEventListener(e, wake, { passive: true }); });
  function isPlayingVideo() { return Story.isVideo(state.node) && !video.hidden; }
  function pauseFilm() { sound.pause(); paused = true; if (isPlayingVideo() && !video.paused) video.pause(); }
  function resumeFilm() {
    sound.resume();
    if (isPlayingVideo() && video.paused && !video.ended) {
      var p = video.play();
      if (p && p.catch) p.catch(function () { showToast("请再点一次继续播放"); });
    }
    paused = false;
  }
  function openMenu() {
    pauseFilm();
    menu.hidden = false;
    btnMenu.setAttribute("aria-expanded", "true");
    $("span", mPlay).textContent = isPlayingVideo() ? "继续播放" : "回到画面";
    $("span", mRestart).textContent = "重新开始故事";
    restartArmed = 0;
    mPlay.focus();
  }
  function closeMenu(silent) {
    if (menu.hidden) return;
    menu.hidden = true;
    btnMenu.setAttribute("aria-expanded", "false");
    if (!silent) { resumeFilm(); btnMenu.focus(); }
  }
  btnMenu.addEventListener("click", function () { if (menu.hidden) openMenu(); else closeMenu(); });
  mPlay.addEventListener("click", function () { closeMenu(); });
  mReplay.addEventListener("click", function () {
    menu.hidden = true; btnMenu.setAttribute("aria-expanded", "false");
    if (Story.isVideo(state.node)) playNode(state.node); else enter();
  });
  function applySound(on) {
    sound.setEnabled(on);
    mSound.setAttribute("aria-pressed", String(on));
    $("span", mSound).textContent = on ? "声音开启" : "已静音";
  }
  function applyMotion(reducedOn) {
    if (reducedOn) document.documentElement.setAttribute("data-motion", "reduced");
    else document.documentElement.removeAttribute("data-motion");
    mMotion.setAttribute("aria-pressed", String(reducedOn));
  }
  mSound.addEventListener("click", function () { var on = video.muted; applySound(on); prefs({ sound: on }); });
  mMotion.addEventListener("click", function () { var on = mMotion.getAttribute("aria-pressed") !== "true"; applyMotion(on); prefs({ reduced: on }); });
  mRestart.addEventListener("click", function () {
    if (!restartArmed) { restartArmed = 1; $("span", mRestart).textContent = "再点一次：从片头重来"; return; }
    menu.hidden = true; btnMenu.setAttribute("aria-expanded", "false");
    clearSave();
    dispatch({ type: "RESTART" });
  });
  mHome.addEventListener("click", function () { menu.hidden = true; btnMenu.setAttribute("aria-expanded", "false"); goHome(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) { closeMenu(); return; }
    var tag = (e.target && e.target.tagName) || "";
    if (e.key === " " && isPlayingVideo() && !/BUTTON|INPUT|TEXTAREA|SELECT/.test(tag) && !(e.target && e.target.closest && e.target.closest(".sheet"))) {
      e.preventDefault();
      if (video.paused) { resumeFilm(); showToast("继续播放", 1200); } else { pauseFilm(); showToast("已暂停 · 按空格继续", 1800); }
    }
  });
  // 切到后台：暂停；回来后保持暂停，由玩家决定继续
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (state.node !== "welcome") pauseFilm(); }
    else if (paused && state.node !== "welcome") { openMenu(); }
  });

  /* ================= 启动 ================= */
  sound.onError(showToast);
  var p = prefs();
  applySound(p.sound !== false);
  applyMotion(!!p.reduced);
  window.FilmOverlays.attach(video, $("#ov"), function () { return currentClip; });
  window.__film = { audio: sound.inspect, state: function () { return state; }, dispatch: dispatch, setRate: function (r) { video.playbackRate = r; video.defaultPlaybackRate = r; } };
  enter();
  wake();
})();
