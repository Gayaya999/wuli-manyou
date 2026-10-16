# 配乐与点击音效（2026-10-15）

用户要求：互动时配乐继续；牛顿与学生对坐的分支画面缺音乐，复制前段同一音乐并衔接；点击有音效。

- 原音频来源：用户主片 `main-original.mov`，SHA-256 `1a4c9b0e3cdf9b25e9a19a0d44cd8ee17dccfcda7617f72b9eb051a032246453`。
- 用 Demucs 4.0.1 的 htdemucs 在本机分离伴奏；不上传影片，不替换对白，不生成新配乐。
- 取主片 36–66 秒伴奏；首尾 2 秒等功率交叉淡化，形成 28 秒循环；平均电平 -29 dBFS，峰值约 -12.83 dBFS，低于对白。
- `original-music-loop.mp3`：192 kbps 立体声，保留给编辑/试听。
- `music-data.js`：上述 MP3 的 Base64 表示。内嵌解码为 Web Audio Buffer，不使用 fetch，使双击 index.html / file:// 时也可运行。
- 复现脚本：`tools/build-audio.py <main/no_vocals.wav> <ffmpeg>`。分离命令为 `python -m demucs --two-stems=vocals -d cpu main.wav`。完整音频分析见 `evidence/audio-analysis/loop.json`。
- 原有 14 段 MP4 及其混合音轨保持逐文件相同。补乐在 low、high、accept、relation-question、oneway-feedback、mutual-feedback，以及所有剧情互动停留处播放；原片有配乐处淡出补曲。片尾前 1.4 秒提前衔接，播放加载期间保持补曲。
- 循环使用一个 AudioBufferSource，正常换片和互动不重启；菜单/后台暂停游标，返回片头停止。首次用户点击才解锁音频。静音统一控制影片、配乐和音效。
- 点击声由 `scripts/audio.js` 本地合成：短滤波噪声与衰减正弦轻敲，不含第三方音效素材。鼠标/触屏/键盘激活共用，禁用按钮不响应。

分离伴奏是从用户影片混音提取的派生素材，并非原始独立音乐母带；版权沿用用户原素材。原文件及原混音仍保留。
