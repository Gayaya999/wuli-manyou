/* 手稿小游戏：平移预测纸对齐、观察窗检查近/中/远、核对、（必要时）修正。
   预测与参考数据固定，玩家只能平移整张纸、移动观察窗，不能改曲线。
   本文件只负责手稿的输入与绘制；是否离开小游戏由剧情层决定（第一阶段只演示到“把发现写下”）。 */
(function (root) {
  "use strict";
  var C = root.FilmConfig;
  var T = C.copy.notebook;
  var M = C.model;
  var NS = "http://www.w3.org/2000/svg";

  var INK = "#49301f", INK2 = "#73563c", DIFF = "#8c4b36", DIFF_LINE = "#b9765c", BRASS = "#9c6a2a";
  var POS_X = [150, 400, 650];
  function X(r) { return 150 + (r - 1) * 500; }
  function Y(v) { return 400 - v * 270; }
  var CROSS = [[90, 86], [704, 426]];
  var MAX_OFF = 70;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, attrs) {
    var a = { x: x, y: y };
    for (var k in attrs) a[k] = attrs[k];
    var t = el("text", a, parent);
    t.textContent = str;
    return t;
  }
  function curvePath(values) {
    if (values[0] === values[2]) return "M" + X(1) + " " + Y(values[0]) + " L" + X(2) + " " + Y(values[0]);
    var d = "";
    for (var i = 0; i <= 40; i++) {
      var r = 1 + i / 40;
      d += (i ? " L" : "M") + X(r).toFixed(1) + " " + Y(1 / (r * r)).toFixed(1);
    }
    return d;
  }
  function cross(parent, x, y, color, w) {
    var g = el("g", {}, parent);
    el("line", { x1: x - 11, y1: y, x2: x + 11, y2: y, stroke: color, "stroke-width": w }, g);
    el("line", { x1: x, y1: y - 11, x2: x, y2: y + 11, stroke: color, "stroke-width": w }, g);
    el("circle", { cx: x, cy: y, r: 5, fill: "none", stroke: color, "stroke-width": w * 0.8 }, g);
    return g;
  }
  function reduced() {
    return document.documentElement.getAttribute("data-motion") === "reduced" ||
      (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function tween(from, to, ms, ease, step, done) {
    if (reduced() || ms <= 0) { step(to); if (done) done(); return function () {}; }
    var t0 = performance.now(), id = 0, stopped = false;
    function frame(now) {
      if (stopped) return;
      var p = Math.max(0, Math.min(1, (now - t0) / ms));
      step(from + (to - from) * ease(p));
      if (p < 1) id = requestAnimationFrame(frame); else if (done) done();
    }
    id = requestAnimationFrame(frame);
    return function () { stopped = true; cancelAnimationFrame(id); };
  }
  function settle(p) { return 1 - Math.pow(1 - p, 3); }

  function create(scene, opts) {
    opts = opts || {};
    function touch() { if (opts.onInteract) opts.onInteract(); }
    var svg = scene.querySelector(".sheet");
    var taskEl = scene.querySelector("#nb-task");
    var statusEl = scene.querySelector("#nb-status");
    var primary = scene.querySelector("#nb-primary");
    var autoBtn = scene.querySelector("#nb-auto");
    var helpBtn = scene.querySelector("#nb-help-btn");
    var help = scene.querySelector("#nb-help");
    var onNote = opts.onNote || function () {};
    var onProgress = opts.onProgress || function () {};
    var onComplete = opts.onComplete || function () {};

    var S;
    var stopAnim = function () {};

    /* ---------- 绘制骨架 ---------- */
    svg.innerHTML = "";
    var defs = el("defs", {}, svg);
    // 墨线的轻微笔触起伏只影响渲染，不改数据与拖动坐标。
    var ink = el("filter", { id: "nb-ink", x: "-3%", y: "-3%", width: "106%", height: "106%" }, defs);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.045 0.12", numOctaves: "2", seed: "7", result: "grain" }, ink);
    el("feDisplacementMap", { "in": "SourceGraphic", in2: "grain", scale: "1.1", xChannelSelector: "R", yChannelSelector: "G" }, ink);
    var f = el("filter", { id: "nb-grain", x: "0", y: "0", width: "100%", height: "100%" }, defs);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9", numOctaves: "2", seed: "11", result: "n" }, f);
    el("feColorMatrix", { "in": "n", type: "matrix", values: "0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.16  0 0 0 0.11 0" }, f);
    var rg = el("radialGradient", { id: "nb-vig", cx: "50%", cy: "50%", r: "65%" }, defs);
    el("stop", { offset: "48%", "stop-color": "#8d5328", "stop-opacity": "0" }, rg);
    el("stop", { offset: "100%", "stop-color": "#8d5328", "stop-opacity": "0.58" }, rg);
    var cpReveal = el("clipPath", { id: "nb-reveal" }, defs);
    var revealRect = el("rect", { x: 0, y: 0, width: 800, height: 500 }, cpReveal);
    var cpErase = el("clipPath", { id: "nb-erase" }, defs);
    var eraseRect = el("rect", { x: 0, y: 0, width: 800, height: 500 }, cpErase);
    var glass = el("linearGradient", { id: "nb-glass", x1: "0", y1: "0", x2: "1", y2: "0" }, defs);
    el("stop", { offset: "0%", "stop-color": "#fffaf0", "stop-opacity": "0.42" }, glass);
    el("stop", { offset: "45%", "stop-color": "#fffaf0", "stop-opacity": "0.16" }, glass);
    el("stop", { offset: "100%", "stop-color": "#fffaf0", "stop-opacity": "0.34" }, glass);

    // 参考底稿
    var paperD = "M10 10 L36 6 L64 11 L101 5 L146 10 L178 5 L183 14 L191 7 L240 10 L285 5 L328 11 L375 6 L421 10 L464 5 L509 11 L556 6 L603 10 L647 5 L691 11 L736 6 L790 10 L794 43 L789 78 L795 115 L790 158 L795 203 L790 249 L796 288 L789 327 L795 367 L790 412 L795 450 L789 490 L754 495 L710 489 L665 495 L621 489 L578 494 L535 489 L490 495 L446 490 L401 496 L358 489 L312 495 L268 490 L222 496 L179 489 L135 495 L92 489 L50 495 L9 490 L5 452 L11 409 L5 368 L10 325 L4 283 L10 242 L5 201 L11 160 L5 120 L10 78 L5 40 Z";
    var texture = el("pattern", { id: "nb-parchment", patternUnits: "userSpaceOnUse", width: 600, height: 600 }, defs);
    el("image", { href: "assets/ui/parchment-texture-v1.png", x: 0, y: 0, width: 600, height: 600 }, texture);
    el("path", { d: paperD, fill: "#ead5a4" }, svg);
    el("path", { d: paperD, fill: "url(#nb-parchment)", stroke: "#956235", "stroke-width": 2 }, svg);
    el("path", { d: paperD, filter: "url(#nb-grain)" }, svg);
    el("path", { d: paperD, fill: "url(#nb-vig)" }, svg);
    el("path", { d: "M400 15 L395 240 L402 486 M15 252 Q400 244 785 256", fill: "none", stroke: "#a87e49", "stroke-opacity": ".12", "stroke-width": 2, "class": "paper-crease" }, svg);
    el("path", { d: "M403 15 L398 240 L405 486", fill: "none", stroke: "#fff6dc", "stroke-opacity": ".38", "stroke-width": 2, "class": "paper-crease" }, svg);
    var base = el("g", { "class": "ink-strokes" }, svg);
    // 坐标轴（无数字）
    el("line", { x1: 110, y1: 112, x2: 110, y2: 410, stroke: INK2, "stroke-width": 1.4 }, base);
    el("line", { x1: 110, y1: 410, x2: 680, y2: 410, stroke: INK2, "stroke-width": 1.4 }, base);
    text(base, 96, 136, "强", { "font-size": 17, "text-anchor": "end", "class": "lab" });
    text(base, 96, 406, "弱", { "font-size": 17, "text-anchor": "end", "class": "lab" });
    POS_X.forEach(function (x) { el("line", { x1: x, y1: 404, x2: x, y2: 416, stroke: INK2, "stroke-width": 1.4 }, base); });
    // 参考曲线：固定
    el("path", { d: curvePath(M.reference), fill: "none", stroke: INK, "stroke-width": 2.4, "stroke-linecap": "round" }, base);
    CROSS.forEach(function (c) { cross(base, c[0], c[1], INK2, 1.3); });

    // 预测纸（可平移）
    var pred = el("g", { tabindex: "0", role: "button", "aria-label": "预测纸。拖动或用方向键移动，让两组十字重合。" }, svg);
    var predPaper = el("g", { "data-grab": "1" }, pred);
    el("rect", { x: 64, y: 62, width: 672, height: 398, fill: "transparent", stroke: "none", "class": "prediction-hit" }, predPaper);
    // 纸角：可抓的折角
    
    
    el("circle", { cx: 721, cy: 445, r: 34, fill: "transparent" }, predPaper);
    // 纸角热点：提示“抓这里”
    var cornerHot = el("g", { "pointer-events": "none" }, predPaper);
    el("circle", { cx: 721, cy: 445, r: 17, fill: "none", stroke: "#2a241d", "stroke-width": 2.4, "class": "nb-pulse" }, cornerHot);
    el("circle", { cx: 722, cy: 444, r: 21, fill: "none", stroke: "#9c6a2a", "stroke-width": 1.4, "class": "nb-pulse is-late" }, cornerHot);
    el("circle", { cx: 721, cy: 445, r: 7, fill: "#c48d3f", stroke: "#2a241d", "stroke-width": 2 }, cornerHot);
    var pcross = el("g", { "class": "pcross" }, predPaper);
    CROSS.forEach(function (c) { cross(pcross, c[0], c[1], INK, 1.8); });
    var predLineOld = el("path", { d: "", fill: "none", stroke: INK, "stroke-width": 2.8, "stroke-dasharray": "8 5 10 6 7 5", "stroke-linecap": "round", opacity: 0, "clip-path": "url(#nb-erase)", "class": "pred-line" }, predPaper);
    var predLine = el("path", { d: "", fill: "none", stroke: INK, "stroke-width": 2.8, "stroke-dasharray": "8 5 10 6 7 5", "stroke-linecap": "round", "clip-path": "url(#nb-reveal)", "class": "pred-line" }, predPaper);
    // 核对通过后盖下的“合”字印
    var doneMark = el("g", { opacity: 0, "class": "seal", transform: "rotate(-8 690 98)" }, pred);
    el("rect", { x: 662, y: 70, width: 56, height: 56, rx: 8, fill: "rgba(181,82,58,0.08)", stroke: "#b5523a", "stroke-width": 3 }, doneMark);
    text(doneMark, 690, 110, "合", { "class": "serif", "font-size": 34, "text-anchor": "middle", fill: "#b5523a" });
    var predRing = el("rect", { x: 58, y: 56, width: 684, height: 410, "class": "focus-ring" }, pred);

    // 偏差标记（核对后出现）
    var diffG = el("g", { opacity: 0, "class": "diff" }, svg);
    // 记录墨点
    var recG = el("g", {}, svg);
    var recDots = POS_X.map(function (x) { return el("circle", { cx: x, cy: 426, r: 4, fill: INK, opacity: 0, "class": "rec-dot" }, recG); });
    // 位置标签（可点）
    var posG = el("g", {}, svg);
    var posLabels = POS_X.map(function (x, i) {
      var g = el("g", { "class": "pos-label", "data-pos": i }, posG);
      el("rect", { x: x - 45, y: 430, width: 90, height: 40, fill: "transparent" }, g);
      text(g, x, 462, ["近", "中", "远"][i], { "font-size": 18, "text-anchor": "middle", "class": "lab" });
      return g;
    });

    // 纸头与图例：画在最上层，预测纸移动时也不被遮住
    var head = el("g", { "pointer-events": "none", "class": "wide-only" }, svg);
    text(head, 40, 44, "吸引与距离", { "class": "serif", "font-size": 22 });
    text(head, 160, 44, "同一物体，距离从地心量起", { "font-size": 14, fill: INK2 });
    el("line", { x1: 560, y1: 38, x2: 596, y2: 38, stroke: INK, "stroke-width": 2.4 }, head);
    text(head, 604, 44, "参考", { "font-size": 15 });
    el("line", { x1: 662, y1: 38, x2: 698, y2: 38, stroke: INK, "stroke-width": 2.6, "stroke-dasharray": "8 5" }, head);
    text(head, 706, 44, "预测", { "font-size": 15 });

    // 观察窗
    var win = el("g", { tabindex: "-1", role: "slider", "aria-label": "观察窗位置", "aria-valuemin": "0", "aria-valuemax": "2", "aria-orientation": "horizontal" }, svg);
    var winBody = el("g", { "data-grab": "1" }, win);
    // 黄铜检视框：玻璃反光 + 顶部旋钮
    // 检视框：半透明纸框 + 墨线 + 赭黄旋钮（平涂，无反光）
    el("rect", { x: -32, y: 104, width: 64, height: 296, rx: 5, fill: "transparent", stroke: "#2a241d", "stroke-width": 2.6, "class": "win-frame" }, winBody);
    el("line", { x1: -32, y1: 120, x2: 32, y2: 120, stroke: "#2a241d", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0.5 }, winBody);
    el("line", { x1: 0, y1: 92, x2: 0, y2: 104, stroke: "#2a241d", "stroke-width": 2.6 }, winBody);
    el("circle", { cx: 0, cy: 86, r: 9.5, fill: "#c48d3f", stroke: "#2a241d", "stroke-width": 2.2 }, winBody);
    el("circle", { cx: -3, cy: 83, r: 2.6, fill: "#f5ecd6" }, winBody);
    el("rect", { x: -40, y: 84, width: 80, height: 318, fill: "transparent" }, winBody);
    var refPt = el("circle", { cx: 0, cy: 0, r: 4.5, fill: INK }, win);
    var predPt = el("circle", { cx: 0, cy: 0, r: 7, fill: "none", stroke: INK, "stroke-width": 1.8 }, win);
    var winRing = el("rect", { x: -36, y: 84, width: 72, height: 322, "class": "focus-ring" }, win);
    // 检视结论用图形表达：两线重合 = 黄铜同心圆；预测偏高 = 红褐色上下括弧
    var badge = el("g", { "class": "win-badge", "pointer-events": "none" }, win);
    var badgeSame = el("g", {}, badge);
    el("circle", { cx: 0, cy: 0, r: 13, fill: "#c48d3f", stroke: "#2a241d", "stroke-width": 2.2 }, badgeSame);
    el("path", { d: "M-6 0 L-1.5 5 L7 -5", fill: "none", stroke: "#2a241d", "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }, badgeSame);
    var badgeGap = el("g", {}, badge);
    el("circle", { cx: 0, cy: 0, r: 13, fill: "#f5ecd6", stroke: "#a83a2a", "stroke-width": 2.4 }, badgeGap);
    el("path", { d: "M0 -7 L0 7 M-4 -3 L0 -7 L4 -3 M-4 3 L0 7 L4 3", fill: "none", stroke: "#8c4b36", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, badgeGap);
    // 核对后在近/中/远标签上方标出 ✓ / ✕
    var verdictG = el("g", { "pointer-events": "none" }, svg);

    // 纸面文字：比较结果 + 模型说明
    var compareText = text(svg, 40, 486, "", { "font-size": 17, "class": "wide-only" });
    text(svg, 762, 486, T.modelNote, { "font-size": 12.5, fill: INK2, "text-anchor": "end", "class": "wide-only" });
    var compareHtml = scene.querySelector("#nb-compare");
    var liveCompare = document.createElement("span");
    liveCompare.className = "sr-only";
    liveCompare.setAttribute("aria-live", "polite");
    statusEl.parentNode.insertBefore(liveCompare, statusEl);

    /* ---------- 状态 ---------- */
    function fresh(hyp) {
      return {
        original: hyp, current: hyp, revision: 0,
        aligned: false, off: { x: 38, y: -24 },
        pos: 0, winX: POS_X[0],
        inspected: [false, false, false],
        checked: null, mismatchSeen: false, verifiedRevision: -1,
        completed: false, step: "align"
      };
    }
    function scale() { return svg.getBoundingClientRect().width / 800 || 1; }
    function minVisibleOffset() {
      // 初始偏移至少约 24 CSS px，且不超过可拖范围
      var need = 28 / scale();
      var k = Math.min(MAX_OFF - 6, Math.max(1, need / Math.hypot(38, 24)) * Math.hypot(38, 24)) / Math.hypot(38, 24);
      return { x: 38 * k, y: -24 * k };
    }

    function predValues() { return M.predictions[S.current]; }
    function compareAt(i) {
      var p = predValues()[i], r = M.reference[i];
      return Math.abs(p - r) < 1e-9 ? T.same : T.higher;
    }

    /* ---------- 渲染 ---------- */
    function render() {
      pred.setAttribute("transform", "translate(" + S.off.x.toFixed(2) + " " + S.off.y.toFixed(2) + ")");
      predLine.setAttribute("d", curvePath(predValues()));
      win.setAttribute("transform", "translate(" + S.winX.toFixed(2) + " 0)");
      var observing = S.step !== "align";
      win.style.display = observing ? "" : "none";
      win.setAttribute("tabindex", observing && S.step === "observe" ? "0" : "-1");
      pred.setAttribute("tabindex", S.step === "align" ? "0" : "-1");
      pred.setAttribute("aria-disabled", S.step === "align" ? "false" : "true");
      predPaper.style.cursor = S.step === "align" ? "" : "default";
      cornerHot.style.display = S.step === "align" ? "" : "none";
      pred.classList.toggle("is-near", S.step === "align" && Math.hypot(S.off.x, S.off.y) * scale() < 40);
      posG.style.pointerEvents = S.step === "observe" ? "" : "none";
      posG.style.opacity = observing ? "1" : "0.55";

      // 观察窗内的两点
      var i = S.pos;
      var near = Math.abs(S.winX - POS_X[i]) < 0.5;
      refPt.setAttribute("cy", Y(M.reference[i]).toFixed(1));
      predPt.setAttribute("cy", Y(predValues()[i]).toFixed(1));
      refPt.style.opacity = predPt.style.opacity = near ? "1" : "0";
      var same = Math.abs(predValues()[i] - M.reference[i]) < 1e-9;
      var yTop = Math.min(Y(predValues()[i]), Y(M.reference[i]));
      badge.setAttribute("transform", "translate(0 " + (yTop - 30).toFixed(1) + ")");
      badge.style.opacity = near && S.step === "observe" ? "1" : "0";
      badgeSame.style.display = same ? "" : "none";
      badgeGap.style.display = same ? "none" : "";
      verdictG.innerHTML = "";
      if (S.step === "mismatch" || S.step === "verified" || S.step === "done") {
        POS_X.forEach(function (x, k) {
          var ok = Math.abs(predValues()[k] - M.reference[k]) < 1e-9;
          var g = el("g", { transform: "translate(" + x + " 388)" }, verdictG);
          el("circle", { cx: 0, cy: 0, r: 11, fill: ok ? "#c48d3f" : "#f5ecd6", stroke: ok ? "#2a241d" : "#a83a2a", "stroke-width": 2 }, g);
          el("path", { d: ok ? "M-5 0 L-1 4 L6 -4" : "M-4 -4 L4 4 M4 -4 L-4 4", fill: "none", stroke: ok ? "#2a241d" : "#a83a2a", "stroke-width": 2.4, "stroke-linecap": "round" }, g);
        });
      }
      win.setAttribute("aria-valuenow", String(i));
      win.setAttribute("aria-valuetext", T.positions[i]);

      recDots.forEach(function (d, k) { d.setAttribute("opacity", S.inspected[k] ? "1" : "0"); });
      diffG.setAttribute("opacity", S.step === "mismatch" ? "1" : "0");
      doneMark.setAttribute("opacity", S.step === "verified" || S.step === "done" ? "1" : "0");

      // 文案
      var task, status = "", label = null, enabled = true, compare = "";
      if (S.step === "align") {
        task = T.tasks.align;
      } else if (S.step === "observe") {
        var all = S.inspected.every(Boolean);
        task = all ? T.tasks.check : T.tasks.observe;
        compare = near ? compareAt(i) : "";
        if (all) {
          label = T.actions.check;
        } else {
          label = T.actions.record;
          enabled = near && !S.inspected[i];
          var left = [];
          S.inspected.forEach(function (v, k) { if (!v) left.push(T.positions[k]); });
          status = S.inspected[i] ? "这里已记下。还要看：" + left.join("、") : "还要看：" + left.join("、");
        }
        if (S.revision > 0 && !S.inspected.some(Boolean)) status = "换上了新的预测纸。再看一遍：近处、中间、远处";
      } else if (S.step === "mismatch") {
        task = T.tasks.mismatch;
        compare = T.mismatch;
        label = T.actions.revise;
      } else if (S.step === "verified") {
        task = T.tasks.verified;
        compare = T.verified;
        label = T.actions.write;
      } else {
        task = T.tasks.done;
        compare = T.verified;
        label = T.actions.written;
        enabled = false;
      }
      if (taskEl.textContent !== task) taskEl.textContent = task;
      // 进度用三颗点表示：近 / 中 / 远，记下的点为黄铜色；文字只留给读屏
      if (S.step === "observe") {
        statusEl.innerHTML = '<span class="pips" aria-hidden="true">' + S.inspected.map(function (v, k) {
          return '<i class="pip' + (v ? " is-done" : "") + (k === i && near ? " is-here" : "") + '"><b>' + ["近", "中", "远"][k] + '</b></i>';
        }).join("") + '</span><span class="sr-only">' + (status || compare) + '</span>';
      } else {
        statusEl.innerHTML = status ? '<span class="sr-only">' + status + '</span>' : "";
      }
      compareText.textContent = "";
      compareHtml.textContent = "";
      liveCompare.textContent = compare;
      primary.hidden = label === null;
      if (label !== null) { primary.textContent = label; primary.disabled = !enabled; }
      autoBtn.hidden = S.step !== "align";
    }

    function drawDiffs() {
      diffG.innerHTML = "";
      var pv = predValues();
      POS_X.forEach(function (x, i) {
        var yp = Y(pv[i]), yr = Y(M.reference[i]);
        if (Math.abs(yp - yr) < 1) return;
        var xx = x + (i === 2 ? -18 : 18);
        el("line", { x1: xx, y1: yp + 6, x2: xx, y2: yr - 6, "data-y2": yr - 6, stroke: DIFF_LINE, "stroke-width": 2.8 }, diffG);
        el("line", { x1: xx - 6, y1: yp + 6, x2: xx + 6, y2: yp + 6, stroke: DIFF_LINE, "stroke-width": 2 }, diffG);
        el("line", { x1: xx - 6, y1: yr - 6, x2: xx + 6, y2: yr - 6, stroke: DIFF_LINE, "stroke-width": 2 }, diffG);
        text(diffG, xx + (i === 2 ? -10 : 10), (yp + yr) / 2 + 5, "偏差", { "font-size": 15, fill: DIFF, "text-anchor": i === 2 ? "end" : "start", "class": "lab" });
      });
    }

    /* ---------- 点击反馈 ---------- */
    var FX = root.FilmFX;
    var sheetFx = scene.querySelector(".sheet-fx");
    var wrap = scene.querySelector(".sheet-wrap");
    function fxAt(x, y, tone, size) {
      if (!FX || !sheetFx) return;
      sheetFx.style.setProperty("--u", scale() + "px");
      FX.ripple(sheetFx, x, y, { tone: tone, size: size || 0.8, drops: tone === "ink" ? 7 : 9 });
    }
    function animateDiffs() {
      Array.prototype.forEach.call(diffG.querySelectorAll("line[data-y2]"), function (ln) {
        var y1 = +ln.getAttribute("y1"), y2 = +ln.getAttribute("data-y2");
        tween(y1, y2, 520, settle, function (y) { ln.setAttribute("y2", y.toFixed(1)); });
      });
    }

    /* ---------- 动作（每个动作都先检查前置条件） ---------- */
    function snapCheck(pointerType) {
      if (S.step !== "align") return;
      var px = Math.hypot(S.off.x, S.off.y) * scale();
      var limit = pointerType === "touch" ? 16 : 12;
      if (px <= limit) alignNow();
      else statusEl.textContent = T.notAligned;
    }
    function alignNow() {
      if (S.step !== "align") return;
      stopAnim();
      var fx = S.off.x, fy = S.off.y;
      stopAnim = tween(1, 0, 160, settle, function (k) { S.off.x = fx * k; S.off.y = fy * k; render(); }, function () {
        S.off.x = 0; S.off.y = 0; S.aligned = true; S.step = "observe";
        S.pos = 0; S.winX = POS_X[0];
        render();
        CROSS.forEach(function (c) { fxAt(c[0], c[1], "brass", 0.7); });
        onProgress(S);
        win.focus({ preventScroll: true });
        onNote("已对齐，纸的位置锁定。");
      });
    }
    function moveWindowTo(i, animate) {
      if (S.step !== "observe") return;
      stopAnim();
      S.pos = i;
      var from = S.winX, to = POS_X[i];
      if (!animate) { S.winX = to; render(); return; }
      stopAnim = tween(from, to, 120, settle, function (x) { S.winX = x; render(); }, function () { S.winX = to; render(); });
    }
    function record() {
      if (S.step !== "observe") return;
      if (Math.abs(S.winX - POS_X[S.pos]) > 0.5 || S.inspected[S.pos]) return;
      S.inspected[S.pos] = true;
      render();
      var dot = recDots[S.pos];
      fxAt(POS_X[S.pos], Y(M.reference[S.pos]), "ink", 0.6);
      tween(0, 1, 360, settle, function (k) { dot.setAttribute("r", (k < 0.6 ? k / 0.6 * 9 : 9 - (k - 0.6) / 0.4 * 5).toFixed(2)); });
      onProgress(S);
      var next = S.inspected.indexOf(false);
      if (next !== -1) moveWindowTo(next, true);
      else primary.focus();
    }
    function check() {
      if (S.step !== "observe" || !S.aligned || !S.inspected.every(Boolean)) return;
      var ok = predValues().every(function (v, i) { return Math.abs(v - M.reference[i]) < 1e-9; });
      if (ok && S.current === "weakens" && (S.original === "weakens" || S.mismatchSeen)) {
        S.checked = "pass"; S.verifiedRevision = S.revision; S.step = "verified";
        render();
        if (FX) FX.stamp(doneMark);
        fxAt(690, 98, "brass", 1.1);
      } else {
        S.checked = "mismatch"; S.mismatchSeen = true; S.step = "mismatch";
        drawDiffs();
        diffG.querySelectorAll("line[data-y2]").forEach(function (ln) { ln.setAttribute("y2", ln.getAttribute("y1")); });
        render();
        animateDiffs();
        if (FX) FX.nudge(wrap);
      }
      onProgress(S);
      primary.focus();
    }
    function revise() {
      if (S.step !== "mismatch" || !S.mismatchSeen) return;
      var oldD = predLine.getAttribute("d");
      S.current = "weakens"; S.revision += 1;
      S.inspected = [false, false, false]; S.checked = null;
      S.step = "observe"; S.pos = 0; S.winX = POS_X[0];
      predLineOld.setAttribute("d", oldD);
      predLineOld.setAttribute("opacity", "1");
      eraseRect.setAttribute("x", "0");
      revealRect.setAttribute("width", "0");
      render();
      // 旧线从左往右擦掉，新线从左往右重新描出
      tween(0, 800, 380, settle, function (x) { eraseRect.setAttribute("x", x.toFixed(1)); }, function () {
        predLineOld.setAttribute("opacity", "0");
        tween(0, 800, 640, settle, function (w) { revealRect.setAttribute("width", w.toFixed(1)); });
      });
      onProgress(S);
      win.focus({ preventScroll: true });
    }
    function write() {
      if (S.step !== "verified" || S.verifiedRevision !== S.revision) return;
      S.completed = true; S.step = "done";
      render();
      fxAt(400, 250, "brass", 2);
      onComplete(S);
      onNote("手稿已完成。第二阶段会从这里接上 distance 片段。");
    }

    primary.addEventListener("click", function () {
      if (S.step === "observe") { if (S.inspected.every(Boolean)) check(); else record(); }
      else if (S.step === "mismatch") revise();
      else if (S.step === "verified") write();
    });
    autoBtn.addEventListener("click", alignNow);
    helpBtn.addEventListener("click", function () {
      var open = help.hidden;
      help.hidden = !open;
      helpBtn.setAttribute("aria-expanded", String(open));
    });

    /* ---------- 指针 ---------- */
    function toModel(evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      var m = svg.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    var drag = null;
    function endDrag(evt, cancelled) {
      if (!drag) return;
      var d = drag; drag = null;
      svg.classList.remove("is-grabbing");
      try { svg.releasePointerCapture(d.id); } catch (e) {}
      if (cancelled) { render(); return; }
      if (d.kind === "paper") snapCheck(d.type);
      else {
        var best = 0;
        POS_X.forEach(function (x, i) { if (Math.abs(S.winX - x) < Math.abs(S.winX - POS_X[best])) best = i; });
        moveWindowTo(best, true);
      }
    }
    svg.addEventListener("pointerdown", function (evt) {
      var t = evt.target;
      var p = toModel(evt);
      var lab = t.closest && t.closest(".pos-label");
      if (lab && S.step === "observe") { touch(); moveWindowTo(+lab.getAttribute("data-pos"), true); evt.preventDefault(); return; }
      if (S.step === "align" && predPaper.contains(t)) {
        stopAnim();
        drag = { kind: "paper", id: evt.pointerId, type: evt.pointerType, sx: p.x, sy: p.y, ox: S.off.x, oy: S.off.y };
      } else if (S.step === "observe" && winBody.contains(t)) {
        stopAnim();
        drag = { kind: "win", id: evt.pointerId, type: evt.pointerType, dx: p.x - S.winX };
      } else return;
      evt.preventDefault();
      touch();
      svg.classList.add("is-grabbing");
      try { svg.setPointerCapture(evt.pointerId); } catch (e) {}
    });
    svg.addEventListener("pointermove", function (evt) {
      if (!drag || evt.pointerId !== drag.id) return;
      var p = toModel(evt);
      if (drag.kind === "paper") {
        S.off.x = Math.max(-MAX_OFF, Math.min(MAX_OFF, drag.ox + p.x - drag.sx));
        S.off.y = Math.max(-MAX_OFF, Math.min(MAX_OFF, drag.oy + p.y - drag.sy));
        statusEl.textContent = "";
      } else {
        S.winX = Math.max(POS_X[0], Math.min(POS_X[2], p.x - drag.dx));
        var best = 0;
        POS_X.forEach(function (x, i) { if (Math.abs(S.winX - x) < Math.abs(S.winX - POS_X[best])) best = i; });
        S.pos = best;
        if (Math.abs(S.winX - POS_X[best]) < 14) S.winX = POS_X[best];
      }
      render();
    });
    svg.addEventListener("pointerup", function (evt) { if (drag && evt.pointerId === drag.id) endDrag(evt, false); });
    svg.addEventListener("pointercancel", function (evt) { if (drag && evt.pointerId === drag.id) endDrag(evt, true); });
    svg.addEventListener("lostpointercapture", function (evt) { if (drag && evt.pointerId === drag.id) endDrag(evt, true); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && drag) endDrag(null, true); });

    /* ---------- 键盘 ---------- */
    pred.addEventListener("keydown", function (evt) {
      if (S.step !== "align") return;
      var step = (evt.shiftKey ? 10 : 2) / scale();
      var k = evt.key;
      if (k === "ArrowLeft") S.off.x = Math.max(-MAX_OFF, S.off.x - step);
      else if (k === "ArrowRight") S.off.x = Math.min(MAX_OFF, S.off.x + step);
      else if (k === "ArrowUp") S.off.y = Math.max(-MAX_OFF, S.off.y - step);
      else if (k === "ArrowDown") S.off.y = Math.min(MAX_OFF, S.off.y + step);
      else if (k === "Enter" || k === " ") { evt.preventDefault(); touch(); snapCheck("keyboard"); return; }
      else return;
      evt.preventDefault();
      if (!evt.repeat) touch();
      render();
    });
    pred.addEventListener("keyup", function (evt) {
      if (/^Arrow/.test(evt.key)) snapCheck("keyboard");
    });
    win.addEventListener("keydown", function (evt) {
      if (S.step !== "observe") return;
      var k = evt.key, i = S.pos;
      if (k === "ArrowLeft") i = Math.max(0, i - 1);
      else if (k === "ArrowRight") i = Math.min(2, i + 1);
      else if (k === "Home") i = 0;
      else if (k === "End") i = 2;
      else if (k === "Enter" || k === " ") { evt.preventDefault(); touch(); if (S.inspected.every(Boolean)) check(); else record(); return; }
      else return;
      evt.preventDefault();
      if (!evt.repeat) touch();
      moveWindowTo(i, true);
    });

    root.addEventListener("resize", function () { render(); });

    /* ---------- 对外：重置与评审跳转 ---------- */
    function reset(hyp) {
      stopAnim();
      S = fresh(hyp || "constant");
      var o = minVisibleOffset();
      S.off.x = o.x; S.off.y = o.y;
      predLine.setAttribute("opacity", "1");
      predLineOld.setAttribute("opacity", "0");
      revealRect.setAttribute("width", "800");
      eraseRect.setAttribute("x", "0");
      help.hidden = true; helpBtn.setAttribute("aria-expanded", "false");
      render();
    }
    function jump(step, hyp) {
      reset(hyp);
      if (step === "align") return;
      S.off = { x: 0, y: 0 }; S.aligned = true; S.step = "observe";
      if (step === "observe") { S.inspected = [true, false, false]; S.pos = 1; S.winX = POS_X[1]; render(); return; }
      if (step === "mismatch") {
        S.original = S.current = "constant";
        S.inspected = [true, true, true]; S.pos = 2; S.winX = POS_X[2];
        check(); return;
      }
      if (step === "verified") {
        if (S.original === "constant") { S.current = "weakens"; S.revision = 1; S.mismatchSeen = true; }
        S.inspected = [true, true, true]; S.pos = 2; S.winX = POS_X[2];
        check(); return;
      }
    }

    reset(opts.hypothesis || "constant");
    return { reset: reset, jump: jump, state: function () { return S; } };
  }

  root.FilmNotebook = { create: create };
})(window);
