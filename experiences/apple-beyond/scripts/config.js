/* 唯一配置来源：素材、停留帧、科学修正时间窗与界面文案。
   时间一律是“片段局部秒数”（= 原片秒数 − 片段起点），由 video.currentTime 驱动。 */
(function (root) {
  "use strict";

  var config = {
    clips: {
      opening: "assets/video/opening.mp4",
      confirmation: "assets/video/confirmation.mp4",
      "relation-question": "assets/video/relation-question.mp4",
      "oneway-feedback": "assets/video/oneway-feedback.mp4",
      "mutual-feedback": "assets/video/mutual-feedback.mp4",
      low: "assets/video/low.mp4",
      orbit: "assets/video/orbit.mp4",
      high: "assets/video/high.mp4",
      accept: "assets/video/accept.mp4",
      "moon-question": "assets/video/moon-question.mp4",
      research: "assets/video/research.mp4",
      distance: "assets/video/distance.mp4",
      "reciprocal-explanation": "assets/video/reciprocal-explanation.mp4",
      "opening-tail": "assets/video/opening-tail.mp4",       /* opening 76.0–80.0s，用于“从影片进入” */
      "moon-tail": "assets/video/moon-tail.mp4",             /* moon-question 9.4–12.9s */
      "research-tail": "assets/video/research-tail.mp4",     /* research 8.8–11.17s，止于地球—立方体图之前 */
      "ending-tail": "assets/video/ending-tail.mp4",         /* ending 12.4–15.9s；不含开头画面 */
      ending: "assets/video/ending.mp4" /* 用户要求恢复交接原片，不烧录或叠加相互吸引修正 */
    },

    /* 停留帧：均已逐帧核对无烘焙字幕 */
    holds: {
      speed: { src: "assets/stills/speed.jpg", from: "opening.mp4 @ 79.6s（主片 79.6s）" },
      hypothesis: { src: "assets/stills/hypothesis.jpg", from: "moon-question.mp4 @ 11.2s（主片 96.6s）" },
      desk: { src: "assets/stills/desk.jpg", from: "research.mp4 @ 9.4s（主片 108.0s）" }
    },

    /* 2026-10-15：用户要求影片使用原画面，取消全部科学修正覆盖。 */
    overlays: [],

    copy: {
      speed: {
        task: "调整速度，让小球绕过地面。",
        hint: "同一起点，只改变向前的速度。",
        commit: "发射",
        low: "这一次，小球落回了地面。",
        high: "这一次，小球飞离了。",
        retry: "再试一次",
        stopNames: ["速度档位一", "速度档位二", "速度档位三"]
      },
      hypothesis: {
        groupLabel: "回答牛顿：相隔这么远，吸引还会一样强吗？",
        constant: "也许远近并不影响吸引。",
        weakens: "也许越远，吸引就越弱。"
      },
      notebook: {
        tasks: { align: "对齐两组十字", observe: "逐处检视", check: "核对预测", mismatch: "远处对不上", verified: "预测与参考一致", done: "已写进手稿" },
        actions: { record: "记下", check: "核对", revise: "修正：越远越弱", write: "写下发现", written: "已写下" },
        same: "这里两条线重合。",
        higher: "这里的预测高于参考。",
        notAligned: "让两组十字重合。",
        mismatch: "近处对上了，远处却没有。这个预测需要修正。",
        verified: "这张预测与本页参考模型一致。",
        modelNote: "模型推演示意，非牛顿原始观测记录。",
        positions: ["近处", "中间", "远处"]
      },
      summary: {
        discoveries: ["向前运动，也在下落。", "距离变远，吸引减弱。", "地球与苹果，相互吸引。"],
        restart: "再走一次",
        back: "返回入口",
        confirm: "从片头重新开始？这一轮的选择记录会清除。",
        confirmYes: "开始新一轮",
        confirmNo: "留在这里"
      },
      media: {
        loading: "正在载入影片…",
        retry: "重试本段",
        missing: "这段影片暂时无法打开，请重试。"
      }
    },

    /* 手稿固定模型：r 为相对地心距离，参考值为 1/r²。玩家不能修改这些数。 */
    model: {
      r: [1, 1.5, 2],
      reference: [1, 4 / 9, 0.25],
      predictions: { constant: [1, 1, 1], weakens: [1, 4 / 9, 0.25] }
    }
  };

  root.FilmConfig = Object.freeze(config);
})(typeof window !== "undefined" ? window : globalThis);
