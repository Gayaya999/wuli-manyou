/* 单一播放会话：每次换片都使旧会话失效；只有当前会话、且只消费一次的 ended 才推进。
   play() 被拒绝或素材错误时停在原画面，给出可操作的恢复入口，不把失败当作播完。 */
(function (root) {
  "use strict";
  var C = root.FilmConfig;
  var sessions = new WeakMap();

  function msgBox(scene) { return scene.querySelector(".stage-msg"); }

  function showMsg(scene, text, actionLabel, action) {
    var box = msgBox(scene);
    box.innerHTML = "";
    var p = document.createElement("p");
    p.style.margin = "0";
    p.textContent = text;
    box.appendChild(p);
    if (actionLabel) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "primary";
      b.textContent = actionLabel;
      b.addEventListener("click", action);
      box.appendChild(b);
    }
    box.hidden = false;
    var btn = box.querySelector("button");
    if (btn) btn.focus();
  }
  function hideMsg(scene) { var box = msgBox(scene); box.hidden = true; box.innerHTML = ""; }

  function stop(scene) {
    var s = sessions.get(scene);
    if (s) { s.dead = true; clearTimeout(s.loadingTimer); }
    var v = scene.querySelector(".clip");
    v.pause();
    v.hidden = true;
    v.style.opacity = "0";
    v.removeAttribute("src");
    v.load();
    hideMsg(scene);
  }

  function play(scene, clipId, handlers) {
    handlers = handlers || {};
    stop(scene);
    var v = scene.querySelector(".clip");
    var s = { dead: false, ended: false, loadingTimer: 0 };
    sessions.set(scene, s);

    v.hidden = false;
    v.style.opacity = "0";
    v.src = C.clips[clipId];

    s.loadingTimer = setTimeout(function () {
      if (!s.dead && v.readyState < 3) showMsg(scene, C.copy.media.loading);
    }, 400);

    function reveal() {
      if (s.dead) return;
      clearTimeout(s.loadingTimer);
      hideMsg(scene);
      v.style.opacity = "1";
      if (handlers.onReveal) handlers.onReveal();
    }
    // 指定提前结束点（例如 research 停在地球—立方体图之前）：逐帧检查，到点即暂停并当作播完
    if (handlers.endAt) {
      (function watch() {
        if (s.dead || s.ended) return;
        if (v.currentTime >= handlers.endAt) {
          v.pause();
          s.ended = true;
          if (handlers.onEnded) handlers.onEnded();
          return;
        }
        requestAnimationFrame(watch);
      })();
    }
    function attempt() {
      var p = v.play();
      if (p && p.catch) {
        p.catch(function () {
          if (s.dead) return;
          clearTimeout(s.loadingTimer);
          if (v.error) return; // 由 error 处理
          showMsg(scene, "浏览器拦下了自动播放。", "点击继续播放", function () { hideMsg(scene); attempt(); });
        });
      }
    }

    v.onplaying = reveal;
    v.onloadeddata = function () { if (!s.dead && !v.paused) reveal(); };
    v.onerror = function () {
      if (s.dead) return;
      clearTimeout(s.loadingTimer);
      v.style.opacity = "0";
      showMsg(scene, C.copy.media.missing + "（" + C.clips[clipId] + "）", C.copy.media.retry, function () {
        play(scene, clipId, handlers);
      });
      if (handlers.onError) handlers.onError();
    };
    v.ontimeupdate = function () {
      if (!s.dead && handlers.onTime) handlers.onTime(v.currentTime);
    };
    v.onended = function () {
      if (s.dead || s.ended) return;
      s.ended = true;
      if (handlers.onEnded) handlers.onEnded();
    };
    attempt();
    return s;
  }

  /* 片段播完后淡出到停留帧，再释放视频 */
  function fadeOut(scene, done) {
    var v = scene.querySelector(".clip");
    var s = sessions.get(scene);
    v.style.opacity = "0";
    setTimeout(function () {
      if (sessions.get(scene) === s) stop(scene);
      if (done) done();
    }, 260);
  }

  root.FilmMedia = { play: play, stop: stop, fadeOut: fadeOut };
})(window);
