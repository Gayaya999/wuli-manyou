/* 手绘动画式的点击反馈：手绘圈扩散、墨点溅开、速度线、笔画描出、纸条飞行、印章落下。
   连续插值播放，保留墨线形态，不用离散 steps 降帧。
   坐标一律是 1280×720 影片设计坐标，由舞台宽度换算；减少动效时直接跳到终态。 */
(function (root) {
  "use strict";

  function reduced() {
    return document.documentElement.getAttribute("data-motion") === "reduced" ||
      (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function unit(el) {
    var scene = el.closest(".scene");
    var stage = (scene && scene.querySelector(".stage")) || el.closest(".stage") || el;
    return stage.getBoundingClientRect().width / 1280 || 1;
  }

  /* 在 layer（舞台内的 .fx-layer）上，于设计坐标 (x, y) 放一圈墨/铜涟漪和若干墨滴 */
  function ripple(layer, x, y, opts) {
    opts = opts || {};
    if (!layer) return;
    var host = document.createElement("div");
    host.className = "fx-ripple" + (opts.tone ? " is-" + opts.tone : "");
    host.style.setProperty("--x", x);
    host.style.setProperty("--y", y);
    host.style.setProperty("--s", opts.size || 1);
    var html = '<i class="fx-ring"></i><i class="fx-ring is-late"></i>';
    if (!reduced()) {
      var n = opts.drops == null ? 7 : Math.min(opts.drops, 8);
      for (var i = 0; i < n; i++) {
        var a = (360 / n) * i + (i % 2 ? 11 : -7);
        var d = 30 + ((i * 37) % 24);
        html += '<i class="fx-drop" style="--a:' + a + 'deg;--d:' + d + ';--z:' + (0.6 + ((i * 13) % 7) / 10) + '"></i>';
      }
      // 大动作（发射、选中）加一圈漫画式速度线
      if (opts.lines || (opts.drops || 0) > 10) {
        for (var k = 0; k < 12; k++) html += '<i class="fx-line" style="--a:' + (k * 30 + 8) + 'deg"></i>';
      }
    }
    host.innerHTML = html;
    layer.appendChild(host);
    setTimeout(function () { host.remove(); }, reduced() ? 260 : 700);
  }

  /* 让 SVG 路径像毛笔一样描出来（需 pathLength="1"） */
  function drawIn(paths, ms, delay) {
    Array.prototype.forEach.call(paths, function (p, i) {
      p.style.animation = "none";
      void p.getBoundingClientRect();
      if (reduced()) { p.style.strokeDashoffset = "0"; return; }
      p.style.strokeDasharray = "1";
      p.style.strokeDashoffset = "1";
      p.style.animation = "fx-draw " + (ms || 600) + "ms cubic-bezier(.22,.65,.3,1) " + ((delay || 0) + i * 45) + "ms forwards";
    });
  }

  /* 把元素从当前位置飞到设计坐标 (x, y)，同时缩小，结束后回调 */
  function flyTo(el, x, y, opts) {
    opts = opts || {};
    var u = unit(el);
    var stage = el.closest(".scene").querySelector(".stage").getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var dx = stage.left + x * u - (r.left + r.width / 2);
    var dy = stage.top + y * u - (r.top + r.height / 2);
    if (reduced() || !el.animate) { if (opts.done) opts.done(); return; }
    var anim = el.animate([
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      { transform: "translate(" + dx * 0.55 + "px," + (dy * 0.55 - 26) + "px) scale(" + ((1 + (opts.scale || 0.2)) / 2) + ") rotate(" + (opts.rotate || -4) / 2 + "deg)", opacity: 1, offset: 0.55 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(" + (opts.scale || 0.2) + ") rotate(" + (opts.rotate || -4) + "deg)", opacity: opts.keep ? 1 : 0 }
    ], { duration: opts.ms || 520, easing: "cubic-bezier(.22,.65,.3,1)", fill: "forwards" });
    anim.onfinish = function () { if (opts.done) opts.done(); };
    return anim;
  }

  /* 弹入：从缩小、略旋转的状态落定，带一点回弹 */
  function popIn(el, opts) {
    opts = opts || {};
    if (reduced() || !el.animate) return;
    // 三格弹出：小 → 稍大 → 原大（手绘动画的“过冲一格”）
    el.animate([
      { transform: "scale(" + (opts.from || 0.6) + ") rotate(" + (opts.rotate || -6) + "deg)", opacity: 0 },
      { transform: "scale(1.08) rotate(" + ((opts.rotate || -6) / -3) + "deg)", opacity: 1, offset: 0.6 },
      { transform: "scale(1) rotate(0deg)", opacity: 1 }
    ], { duration: opts.ms || 420, delay: opts.delay || 0, easing: "cubic-bezier(.22,.65,.3,1)", fill: "backwards" });
  }

  /* 印章：重重落下 */
  function stamp(el) {
    if (reduced() || !el.animate) return;
    el.animate([
      { transform: "scale(1.9) rotate(-18deg)", opacity: 0 },
      { transform: "scale(0.92) rotate(-6deg)", opacity: 1, offset: 0.6 },
      { transform: "scale(1) rotate(-8deg)", opacity: 1 }
    ], { duration: 330, easing: "cubic-bezier(.22,.65,.3,1)", fill: "backwards" });
  }

  /* 轻推：表示“还不行” */
  function nudge(el) {
    if (reduced() || !el.animate) return;
    el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }],
      { duration: 332, easing: "cubic-bezier(.22,.65,.3,1)" });
  }

  root.FilmFX = { ripple: ripple, drawIn: drawIn, flyTo: flyTo, popIn: popIn, stamp: stamp, nudge: nudge, reduced: reduced, unit: unit };
})(window);
