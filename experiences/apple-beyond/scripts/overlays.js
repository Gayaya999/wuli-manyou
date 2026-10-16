/* 科学覆盖层：按 video.currentTime 绘制手稿插镜。暂停即冻结，seek 立即重算，换片清除。 */
(function (root) {
  "use strict";
  var P = root.FilmPlates;
  var C = root.FilmConfig;

  function attach(video, layer, clipId, opts) {
    opts = opts || {};
    // clipId 可以是固定字符串，也可以是返回当前片段 ID 的函数（整片播放器只有一个 video）
    function currentClip() { return typeof clipId === "function" ? clipId() : clipId; }
    function currentWindows() { var id = currentClip(); return C.overlays.filter(function (w) { return w.clip === id; }); }
    var staticKey = null;
    var lastDyn = null;
    var enabled = true;
    var raf = 0;

    layer.innerHTML = '<div class="ov-static"></div><div class="ov-dynamic"></div>';
    var sLayer = layer.firstChild;
    var dLayer = layer.lastChild;

    function active(t) {
      var windows = currentWindows();
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        if (t >= w.from && t < w.to) return w;
      }
      return null;
    }

    function draw() {
      var t = video.currentTime || 0;
      var w = enabled ? active(t) : null;
      if (!w) {
        layer.style.opacity = "0";
        if (staticKey !== null) { sLayer.innerHTML = ""; dLayer.innerHTML = ""; staticKey = null; lastDyn = null; }
        return;
      }
      var alpha = 1;
      if (w.fadeIn > 0) alpha = Math.min(1, (t - w.from) / w.fadeIn);
      layer.style.opacity = String(alpha);

      if (w.kind === "moon") {
        if (staticKey !== "moon") { sLayer.innerHTML = P.moonPlate(0, "static"); staticKey = "moon"; }
        var key = (Math.round(t * 30) / 30).toFixed(3);
        if (key !== lastDyn) { dLayer.innerHTML = P.moonPlate(t, "dynamic"); lastDyn = key; }
      } else if (w.kind === "distance") {
        if (staticKey !== "distance") { sLayer.innerHTML = ""; staticKey = "distance"; }
        var x = Math.round(P.cubeLeftAt(currentClip(), t));
        var dk = x + ":" + Math.round(t * 30);
        if (dk !== lastDyn) { dLayer.innerHTML = P.distanceStrip(x, t); lastDyn = dk; }
      } else if (w.kind === "mutual") {
        // 动画时间从覆盖开始算；ending 开头接着 reciprocal 的末尾继续流动
        var lt = t - w.from + (w.clip === "ending" ? 7.1 : 0);
        if (staticKey !== "mutual") { sLayer.innerHTML = P.mutualPlate(0, "static"); staticKey = "mutual"; lastDyn = null; }
        var mk = (Math.round(lt * 30) / 30).toFixed(3);
        if (mk !== lastDyn) { dLayer.innerHTML = P.mutualPlate(lt, "dynamic"); lastDyn = mk; }
      }
    }

    function loop() {
      draw();
      if (!video.paused && !video.ended) raf = requestAnimationFrame(loop);
      else raf = 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    ["play", "playing"].forEach(function (e) { video.addEventListener(e, kick); });
    ["seeked", "seeking", "timeupdate", "loadeddata", "pause", "ended", "emptied"].forEach(function (e) {
      video.addEventListener(e, draw);
    });
    draw();

    return {
      setEnabled: function (on) { enabled = !!on; draw(); },
      redraw: draw
    };
  }

  root.FilmOverlays = { attach: attach };
})(window);
