/* 剧情状态机：只处理“语义状态”，不碰 DOM 与视频。
   三个入口：initial() 建立初始状态；reduce(state, action) 返回新状态（非法动作原样返回）；validate(saved) 校验存档。
   节点与 03_剧情交互与小游戏.md 的接线表一一对应。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FilmStory = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = 1;

  /* 影片节点：播完后去哪里 */
  var VIDEO = {
    opening: "speed",
    low: "retry",
    high: "retry",
    orbit: "moon-question",
    "moon-question": "hypothesis",
    accept: "research",
    research: "notebook",
    distance: "confirmation",
    confirmation: "relation-question",
    "relation-question": "reciprocity",
    "oneway-feedback": "reciprocal-explanation",
    "mutual-feedback": "reciprocal-explanation",
    "reciprocal-explanation": "ending",
    ending: "summary"
  };
  /* 停留节点：等玩家操作 */
  var HOLD = { welcome: 1, speed: 1, retry: 1, hypothesis: 1, notebook: 1, reciprocity: 1, summary: 1 };
  var SPEED_CLIP = ["low", "orbit", "high"];

  function freshNotebook() {
    return { revision: 0, aligned: false, inspected: [false, false, false], mismatchAcknowledged: false, verifiedRevision: -1, completed: false };
  }
  function initial() {
    return {
      version: VERSION,
      node: "welcome",
      attempts: 0,
      tried: [false, false, false],
      lastSpeed: null,
      originalHypothesis: null,
      currentHypothesis: null,
      notebook: freshNotebook(),
      reciprocity: null
    };
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function isVideo(node) { return Object.prototype.hasOwnProperty.call(VIDEO, node); }
  function isHold(node) { return Object.prototype.hasOwnProperty.call(HOLD, node); }

  /* 手稿是否满足离开条件：已对齐、当前版本三处已记录、当前预测为“越远越弱”、该版本核对通过；
     若最初是“远近不影响”，还必须先核对出偏差并修正过。 */
  function notebookPasses(original, nb) {
    if (!nb || !nb.aligned) return false;
    if (!Array.isArray(nb.inspected) || nb.inspected.length !== 3 || !nb.inspected.every(Boolean)) return false;
    if (nb.current !== "weakens") return false;
    if (nb.verifiedRevision !== nb.revision) return false;
    if (original === "constant" && !(nb.mismatchAcknowledged && nb.revision >= 1)) return false;
    if (original === "weakens" && nb.revision !== 0) return false;
    return true;
  }

  function reduce(state, action) {
    if (!state || !action) return state;
    var s;
    switch (action.type) {
      case "START":
        if (state.node !== "welcome" && state.node !== "summary") return state;
        s = initial();
        s.node = "opening";
        return s;

      case "RESTART": // 结尾“再走一次”，或菜单“重新开始故事”（已确认）
        s = initial();
        s.node = "opening";
        return s;

      case "HOME": // 回到片头封面，保留不了的进度由调用方决定是否清除
        s = initial();
        return s;

      case "MEDIA_ENDED":
        if (!isVideo(state.node) || action.clip !== state.node) return state;
        s = clone(state);
        s.node = VIDEO[state.node];
        return s;

      case "LAUNCH":
        if (state.node !== "speed") return state;
        if ([0, 1, 2].indexOf(action.level) === -1) return state;
        s = clone(state);
        s.attempts += 1;
        s.tried[action.level] = true;
        s.lastSpeed = action.level;
        s.node = SPEED_CLIP[action.level];
        return s;

      case "RETRY":
        if (state.node !== "retry") return state;
        s = clone(state);
        s.node = "speed";
        return s;

      case "HYPOTHESIS":
        if (state.node !== "hypothesis") return state;
        if (action.value !== "constant" && action.value !== "weakens") return state;
        s = clone(state);
        s.originalHypothesis = action.value;
        s.currentHypothesis = action.value;
        s.notebook = freshNotebook();
        s.node = "accept";
        return s;

      case "NOTEBOOK_PROGRESS": // 手稿中途的语义事实（用于存档），不推进节点
        if (state.node !== "notebook" || !action.facts) return state;
        s = clone(state);
        s.currentHypothesis = action.facts.current === "weakens" ? "weakens" : s.originalHypothesis;
        s.notebook = {
          revision: action.facts.revision | 0,
          aligned: !!action.facts.aligned,
          inspected: (action.facts.inspected || []).slice(0, 3).map(Boolean),
          mismatchAcknowledged: !!action.facts.mismatchAcknowledged,
          verifiedRevision: action.facts.verifiedRevision == null ? -1 : action.facts.verifiedRevision,
          completed: false
        };
        return s;

      case "NOTEBOOK_DONE":
        if (state.node !== "notebook") return state;
        if (!notebookPasses(state.originalHypothesis, action.facts)) return state;
        s = clone(state);
        s.currentHypothesis = "weakens";
        s.notebook = {
          revision: action.facts.revision,
          aligned: true,
          inspected: [true, true, true],
          mismatchAcknowledged: !!action.facts.mismatchAcknowledged,
          verifiedRevision: action.facts.verifiedRevision,
          completed: true
        };
        s.node = "distance";
        return s;

      case "RECIPROCITY":
        if (state.node !== "reciprocity") return state;
        if (action.value !== "one-way" && action.value !== "mutual") return state;
        s = clone(state);
        s.reciprocity = action.value;
        s.node = action.value === "one-way" ? "oneway-feedback" : "mutual-feedback";
        return s;

      default:
        return state;
    }
  }

  /* 校验存档：版本、节点和因果关系都要对得上；不合法时退回最近可信检查点 */
  function validate(saved) {
    var base = initial();
    if (!saved || typeof saved !== "object" || saved.version !== VERSION) return { ok: false, state: base, reason: "版本不符或存档损坏" };
    var node = saved.node;
    if (!isVideo(node) && !isHold(node)) return { ok: false, state: base, reason: "未知节点" };
    var s = clone(base);
    s.attempts = Math.max(0, saved.attempts | 0);
    s.tried = Array.isArray(saved.tried) && saved.tried.length === 3 ? saved.tried.map(Boolean) : [false, false, false];
    s.lastSpeed = [0, 1, 2].indexOf(saved.lastSpeed) === -1 ? null : saved.lastSpeed;
    var order = ["welcome", "opening", "speed", "low", "high", "retry", "orbit", "moon-question", "hypothesis", "accept", "research", "notebook",
      "distance", "confirmation", "relation-question", "reciprocity", "oneway-feedback", "mutual-feedback", "reciprocal-explanation", "ending", "summary"];
    var idx = order.indexOf(node);
    var afterOrbit = idx >= order.indexOf("orbit");
    var afterHyp = idx >= order.indexOf("accept");
    var afterNotebook = idx >= order.indexOf("distance");
    var afterRecip = idx >= order.indexOf("oneway-feedback");

    // 进入绕行之后，必须真的选过 Ⅱ 档
    if (afterOrbit && !(s.tried[1] && s.attempts >= 1)) return { ok: false, state: checkpoint(s, "speed"), reason: "缺少发射记录" };
    if (node === "retry" && (s.lastSpeed === null || s.lastSpeed === 1)) return { ok: false, state: checkpoint(s, "speed"), reason: "重试记录不完整" };
    if (afterHyp) {
      if (saved.originalHypothesis !== "constant" && saved.originalHypothesis !== "weakens") return { ok: false, state: checkpoint(s, "hypothesis"), reason: "缺少最初假设" };
      s.originalHypothesis = saved.originalHypothesis;
      s.currentHypothesis = saved.currentHypothesis === "weakens" ? "weakens" : saved.originalHypothesis;
    }
    if (node === "notebook" && saved.notebook) {
      var nb = saved.notebook;
      s.notebook = {
        revision: Math.max(0, nb.revision | 0),
        aligned: !!nb.aligned,
        inspected: Array.isArray(nb.inspected) && nb.inspected.length === 3 ? nb.inspected.map(Boolean) : [false, false, false],
        mismatchAcknowledged: !!nb.mismatchAcknowledged,
        verifiedRevision: typeof nb.verifiedRevision === "number" ? nb.verifiedRevision : -1,
        completed: false
      };
      // 修正版本必须先有偏差记录
      if (s.notebook.revision > 0 && !(s.originalHypothesis === "constant" && s.notebook.mismatchAcknowledged)) {
        s.notebook = freshNotebook(); s.currentHypothesis = s.originalHypothesis;
      }
    }
    if (afterNotebook) {
      var done = saved.notebook && saved.notebook.completed;
      var facts = saved.notebook ? { aligned: saved.notebook.aligned, inspected: saved.notebook.inspected, current: "weakens", revision: saved.notebook.revision, verifiedRevision: saved.notebook.verifiedRevision, mismatchAcknowledged: saved.notebook.mismatchAcknowledged } : null;
      if (!done || !notebookPasses(s.originalHypothesis, facts)) {
        s.notebook = freshNotebook(); s.currentHypothesis = s.originalHypothesis;
        return { ok: false, state: checkpoint(s, "notebook"), reason: "手稿未完成" };
      }
      s.notebook = clone(saved.notebook);
      s.currentHypothesis = "weakens";
    }
    if (afterRecip) {
      if (saved.reciprocity !== "one-way" && saved.reciprocity !== "mutual") return { ok: false, state: checkpoint(s, "reciprocity"), reason: "缺少第三次选择" };
      s.reciprocity = saved.reciprocity;
      if (node === "oneway-feedback" && s.reciprocity !== "one-way") node = "mutual-feedback";
      if (node === "mutual-feedback" && s.reciprocity !== "mutual") node = "oneway-feedback";
    }
    s.node = node;
    return { ok: true, state: s };
  }
  function checkpoint(s, node) { s.node = node; return s; }

  /* 结尾的一行个人记录：只陈述真实经历，不打分 */
  function recordLine(s) {
    var parts = [];
    parts.push(s.attempts <= 1 ? "你一次发射就让小球绕了过去" : "你发射了 " + s.attempts + " 次，才让小球绕了过去");
    if (s.originalHypothesis === "constant") parts.push("在核对后修正了最初的假设");
    else if (s.originalHypothesis === "weakens") parts.push("检查了三个位置，核对了最初的预测");
    return parts.join("，并") + "。";
  }

  return {
    VERSION: VERSION,
    VIDEO: VIDEO,
    initial: initial,
    reduce: reduce,
    validate: validate,
    notebookPasses: notebookPasses,
    isVideo: isVideo,
    isHold: isHold,
    recordLine: recordLine
  };
});
