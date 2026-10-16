/* 科学修正插镜：“天文图谱”风格——深色星图底、金色刻线、有明暗与光晕的球体、渐变金箭头、尾迹与流动光点。
   全部按 1280×720 影片坐标绘制，只占有效画面 y=64…656，下黑边的烘焙字幕保持可见。
   每张图分静态层（底图、天体）与动态层（随片段时间 t 变化的箭头、尾迹、光点），覆盖层只重绘动态层。
   同一份代码也用于把修正画面烧进 ending.mp4。 */
(function (root) {
  "use strict";

  /* 配色取自影片自己的科学镜头：深蓝夜空、奶白轨道线与箭头、带云层的蓝色地球 */
  var GOLD = "#f4ead2", GOLD_D = "#b9ab88", INK_TXT = "#f6efdc";
  var FONT = "'PingFang SC','Microsoft YaHei','Film Sans SC','Noto Sans SC',sans-serif";
  var SERIF = "'Songti SC','STSong','Film Serif SC','Noto Serif SC',serif";

  function f(n) { return (+n).toFixed(1); }
  function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

  /* ---------- 公共定义：渐变、光晕 ---------- */
  function defs(id) {
    return '<defs>' +
      '<radialGradient id="' + id + '-sky" cx="50%" cy="46%" r="75%"><stop offset="0%" stop-color="#22324a"/><stop offset="55%" stop-color="#141f30"/><stop offset="100%" stop-color="#070c15"/></radialGradient>' +
      '<radialGradient id="' + id + '-earth" cx="34%" cy="30%" r="75%"><stop offset="0%" stop-color="#bfe6f2"/><stop offset="28%" stop-color="#5b9cc0"/><stop offset="62%" stop-color="#22557a"/><stop offset="100%" stop-color="#0b2236"/></radialGradient>' +
      '<linearGradient id="' + id + '-night" x1="0.2" y1="0.15" x2="0.95" y2="0.9"><stop offset="45%" stop-color="#040a14" stop-opacity="0"/><stop offset="100%" stop-color="#040a14" stop-opacity="0.78"/></linearGradient>' +
      '<radialGradient id="' + id + '-atmo" cx="50%" cy="50%" r="50%"><stop offset="78%" stop-color="#8ccfff" stop-opacity="0.45"/><stop offset="100%" stop-color="#8ccfff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + '-moon" cx="34%" cy="30%" r="75%"><stop offset="0%" stop-color="#fffbea"/><stop offset="45%" stop-color="#d9d1b4"/><stop offset="100%" stop-color="#5d584a"/></radialGradient>' +
      '<radialGradient id="' + id + '-apple" cx="34%" cy="30%" r="78%"><stop offset="0%" stop-color="#ff9f7f"/><stop offset="30%" stop-color="#d94a35"/><stop offset="75%" stop-color="#8e1f17"/><stop offset="100%" stop-color="#3e0a07"/></radialGradient>' +
      '<radialGradient id="' + id + '-halo-unused" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe2a0" stop-opacity="0.55"/><stop offset="100%" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + '-spark" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fffbe8" stop-opacity="1"/><stop offset="45%" stop-color="#ffd98a" stop-opacity="0.8"/><stop offset="100%" stop-color="#ffb84a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + '-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" stop-color="#ece3cc"/><stop offset="100%" stop-color="#a99e84"/></linearGradient>' +
      '<filter id="' + id + '-cloud" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>' +
      '<radialGradient id="' + id + '-vig" cx="50%" cy="50%" r="72%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></radialGradient>' +
      '</defs>';
  }

  /* 夜空底：深蓝渐变 + 笔触般的星云漩涡（与影片月亮镜头同一画法）+ 星点与十字星芒 */
  function atlas(id, cx, cy) {
    var s = '<filter id="' + id + '-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>';
    s += '<rect x="0" y="64" width="1280" height="592" fill="url(#' + id + '-sky)"/>';
    // 嵌套 svg 把模糊的星云裁在有效画面内，绝不溢到上下黑边（下黑边是影片字幕）
    s += '<svg x="0" y="64" width="1280" height="592" viewBox="0 64 1280 592" overflow="hidden"><g filter="url(#' + id + '-soft)" fill="none" stroke-linecap="round">';
    [[cx, cy, 520, 210, -12, '#3a5378', 46, 0.55], [cx + 60, cy - 20, 430, 160, -8, '#2c4466', 34, 0.6], [cx - 40, cy + 30, 600, 250, -16, '#24395a', 60, 0.5],
     [cx + 20, cy + 10, 330, 120, -10, '#4a6690', 18, 0.45], [cx - 80, cy - 40, 700, 290, -6, '#1d2f4c', 70, 0.45]].forEach(function (e) {
      s += '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="' + e[2] + '" ry="' + e[3] + '" transform="rotate(' + e[4] + ' ' + e[0] + ' ' + e[1] + ')" stroke="' + e[5] + '" stroke-width="' + e[6] + '" stroke-opacity="' + e[7] + '" stroke-dasharray="' + Math.round(e[2] * 1.4) + ' ' + Math.round(e[2] * 0.5) + '"/>';
    });
    s += '<ellipse cx="' + (cx + 260) + '" cy="' + (cy - 150) + '" rx="120" ry="70" fill="#5a4f86" fill-opacity="0.18"/>';
    s += '<ellipse cx="' + (cx - 300) + '" cy="' + (cy + 140) + '" rx="150" ry="80" fill="#3e5f8c" fill-opacity="0.2"/>';
    s += '</g></svg>';
    for (var i = 0; i < 120; i++) {
      var x = rnd(i + 1) * 1280, y = 64 + rnd(i + 301) * 592, r = 0.5 + rnd(i + 601) * 1.4;
      s += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="#fffaf0" opacity="' + f(0.2 + rnd(i + 901) * 0.6) + '"/>';
    }
    for (var j = 0; j < 9; j++) {
      var sx = 60 + rnd(j + 77) * 1160, sy = 90 + rnd(j + 177) * 540, k = 4 + rnd(j + 277) * 5;
      s += '<path d="M' + f(sx) + ' ' + f(sy - k) + ' L' + f(sx + k * 0.22) + ' ' + f(sy - k * 0.22) + ' L' + f(sx + k) + ' ' + f(sy) + ' L' + f(sx + k * 0.22) + ' ' + f(sy + k * 0.22) + ' L' + f(sx) + ' ' + f(sy + k) + ' L' + f(sx - k * 0.22) + ' ' + f(sy + k * 0.22) + ' L' + f(sx - k) + ' ' + f(sy) + ' L' + f(sx - k * 0.22) + ' ' + f(sy - k * 0.22) + ' Z" fill="#fffaf0" opacity="0.85"/>';
    }
    s += '<rect x="0" y="64" width="1280" height="592" fill="url(#' + id + '-vig)"/>';
    return s;
  }

  /* 赛璐璐平涂的天体：亮面 + 一块硬边暗面 + 深棕墨线，和影片人物同一种画法 */
  var INK = "#1f1b16";
  function celShadow(id, cx, cy, r, color, key) {
    // 暗面：用一个偏移的圆从球体里“减”出右下的月牙
    var cid = id + '-cs-' + key;
    return '<clipPath id="' + cid + '"><circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"/></clipPath>' +
      '<path clip-path="url(#' + cid + ')" fill="' + color + '" fill-rule="evenodd" d="M' + f(cx - r * 2) + ' ' + f(cy - r * 2) + ' h' + f(r * 4) + ' v' + f(r * 4) + ' h' + f(-r * 4) + ' Z ' +
      'M' + f(cx - r * 0.22 + r * 1.02) + ' ' + f(cy - r * 0.22) + ' a' + f(r * 1.02) + ' ' + f(r * 1.02) + ' 0 1 0 ' + f(-r * 2.04) + ' 0 a' + f(r * 1.02) + ' ' + f(r * 1.02) + ' 0 1 0 ' + f(r * 2.04) + ' 0 Z"/>';
  }
  function earth(id, cx, cy, r) {
    var k = r / 100, s = '';
    s += '<clipPath id="' + id + '-ec"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/></clipPath>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#4f88ab"/>';
    s += '<g clip-path="url(#' + id + '-ec)"><g fill="#8d9a5a" stroke="' + INK + '" stroke-width="' + f(2.2 / k) + '" stroke-linejoin="round" transform="translate(' + cx + ' ' + cy + ') scale(' + f(k) + ')">' +
      '<path d="M-62 -48 C-40 -70 -6 -66 6 -46 C14 -30 -6 -18 -20 -6 C-34 6 -30 24 -46 30 C-64 36 -82 6 -78 -18 C-76 -32 -70 -40 -62 -48 Z"/>' +
      '<path d="M20 -20 C40 -34 70 -26 76 -6 C82 14 64 22 52 34 C40 46 44 66 26 70 C12 72 6 52 10 36 C14 22 4 2 20 -20 Z"/>' +
      '<path d="M-30 52 C-18 46 -4 54 -6 66 C-8 78 -26 82 -34 74 C-40 68 -38 58 -30 52 Z"/>' +
      '</g>' +
      '<g fill="#f5ecd6" transform="translate(' + cx + ' ' + cy + ') scale(' + f(k) + ')">' +
      '<path d="M-84 -18 C-60 -30 -30 -28 -6 -20 C-30 -16 -58 -12 -84 -10 Z"/>' +
      '<path d="M-20 30 C6 22 40 22 70 30 C40 34 10 36 -20 36 Z"/>' +
      '<path d="M10 -64 C26 -70 44 -68 56 -60 C40 -58 24 -58 10 -60 Z"/>' +
      '</g></g>';
    s += celShadow(id, cx, cy, r, 'rgba(18,34,52,0.55)', 'e');
    s += '<path d="M' + f(cx - r * 0.62) + ' ' + f(cy - r * 0.42) + ' q' + f(r * 0.12) + ' ' + f(-r * 0.26) + ' ' + f(r * 0.36) + ' ' + f(-r * 0.34) + '" fill="none" stroke="#f5ecd6" stroke-width="' + f(Math.max(2, r * 0.06)) + '" stroke-linecap="round"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + INK + '" stroke-width="' + f(Math.max(2.4, r * 0.035)) + '"/>';
    return s;
  }
  function moon(id, cx, cy, r) {
    return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + r + '" fill="#ece4cb"/>' +
      '<circle cx="' + f(cx - r * 0.3) + '" cy="' + f(cy - r * 0.1) + '" r="' + f(r * 0.22) + '" fill="#cfc5a8" stroke="' + INK + '" stroke-width="1"/>' +
      '<circle cx="' + f(cx + r * 0.3) + '" cy="' + f(cy - r * 0.38) + '" r="' + f(r * 0.12) + '" fill="#cfc5a8" stroke="' + INK + '" stroke-width="1"/>' +
      celShadow(id, cx, cy, r, 'rgba(70,62,46,0.45)', 'm' + Math.round(cx)) +
      '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + r + '" fill="none" stroke="' + INK + '" stroke-width="2.4"/>';
  }
  function apple(id, cx, cy, r) {
    var k = r / 44;
    var body = 'M0 -28 C22 -46 52 -28 47 4 C44 34 22 48 0 40 C-22 48 -44 34 -47 4 C-52 -28 -22 -46 0 -28 Z';
    return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + f(k) + ')">' +
      '<clipPath id="' + id + '-ac"><path d="' + body + '"/></clipPath>' +
      '<path d="' + body + '" fill="#c0392b"/>' +
      '<path clip-path="url(#' + id + '-ac)" d="M10 -40 C40 -30 60 0 40 40 C20 60 -10 50 -30 46 C10 40 34 10 10 -40 Z" fill="#8a2219"/>' +
      '<path d="M-28 -12 C-34 0 -34 12 -27 22" fill="none" stroke="#f5ecd6" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="' + body + '" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linejoin="round"/>' +
      '<path d="M0 -28 C1 -40 4 -46 9 -52" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M7 -44 C18 -56 33 -53 38 -46 C28 -38 16 -38 7 -44 Z" fill="#7f9a46" stroke="' + INK + '" stroke-width="2.4"/>' +
      '</g>';
  }

  /* 示意箭头：奶白平涂 + 墨线描边，尾细头宽；与影片里的白色示意箭头同色，多一层体积而不发光 */
  function arrow(id, key, x1, y1, x2, y2, w) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 2) return '';
    var ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    var head = Math.min(L * 0.45, w * 2.6), hw = w * 1.35;
    var bx = x2 - ux * head, by = y2 - uy * head;
    var pts = [
      [x1 + nx * w * 0.3, y1 + ny * w * 0.3], [bx + nx * w * 0.55, by + ny * w * 0.55], [bx + nx * hw, by + ny * hw],
      [x2, y2],
      [bx - nx * hw, by - ny * hw], [bx - nx * w * 0.55, by - ny * w * 0.55], [x1 - nx * w * 0.3, y1 - ny * w * 0.3]
    ].map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join(' L');
    var shadowPts = [
      [bx - nx * w * 0.05, by - ny * w * 0.05], [bx - nx * hw * 0.92, by - ny * hw * 0.92], [x2, y2]
    ].map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join(' L');
    return '<path d="M' + pts + ' Z" fill="#f5ecd6" stroke="' + INK + '" stroke-width="' + f(Math.max(2.2, w * 0.28)) + '" stroke-linejoin="round"/>' +
      '<path d="M' + shadowPts + ' Z" fill="#cdbf9c"/>' +
      '<path d="M' + pts + ' Z" fill="none" stroke="' + INK + '" stroke-width="' + f(Math.max(2.2, w * 0.28)) + '" stroke-linejoin="round"/>';
  }
  function label(x, y, text, size, anchor, opacity) {
    return '<text x="' + f(x) + '" y="' + f(y) + '" font-family="' + SERIF + '" font-size="' + (size || 22) + '" fill="' + INK_TXT + '" fill-opacity="' + (opacity || 0.92) + '" text-anchor="' + (anchor || 'middle') + '" letter-spacing="2" paint-order="stroke" stroke="#070c15" stroke-width="4" stroke-opacity="0.6">' + text + '</text>';
  }
  function note(text) {
    return '<text x="1236" y="622" font-family="' + FONT + '" font-size="15" fill="' + INK_TXT + '" fill-opacity="0.55" text-anchor="end" letter-spacing="1">' + text + '</text>';
  }
  function open() { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">'; }

  /* —— 1. 月亮绕地球（moon-question 局部 0–6.0 秒） ——
     月亮沿轨道走过一段弧，身后拖着渐隐尾迹；虚线是“没有吸引时会沿直线飞走”的方向，
     金色楔形是“向地球落下的那一点”；金箭头是地球的吸引，始终指向地心。 */
  var MOON = { cx: 640, cy: 372, rx: 360, ry: 168, a0: 196, a1: 322, t1: 6.0 };
  function moonPos(deg) { var a = deg * Math.PI / 180; return [MOON.cx + MOON.rx * Math.cos(a), MOON.cy + MOON.ry * Math.sin(a)]; }
  function moonPlate(t, part) {
    var id = 'moon' + (part || '');
    var s = open() + defs(id);
    if (part !== 'dynamic') {
      s += atlas(id, MOON.cx, MOON.cy);
      s += '<ellipse cx="' + MOON.cx + '" cy="' + MOON.cy + '" rx="' + MOON.rx + '" ry="' + MOON.ry + '" fill="none" stroke="#f6efdc" stroke-opacity="0.7" stroke-width="2.2"/>';
      s += earth(id, MOON.cx, MOON.cy, 82);
      s += label(MOON.cx, MOON.cy + 126, '地球', 22);
      s += note('轨道示意，尺度未按比例');
    }
    if (part === 'static') return s + '</svg>';
    var p = Math.max(0, Math.min(1, t / MOON.t1));
    var ease = 1 - Math.pow(1 - p, 1.5);
    var deg = MOON.a0 + (MOON.a1 - MOON.a0) * ease;
    var m = moonPos(deg);
    // 尾迹：一串由淡到亮的弧段
    for (var i = 14; i >= 1; i--) {
      var d0 = deg - i * 2.4, d1 = deg - (i - 1) * 2.4;
      if (d0 < MOON.a0 - 30) continue;
      var a = moonPos(d0), b = moonPos(d1);
      s += '<line x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(b[0]) + '" y2="' + f(b[1]) + '" stroke="#ffe7b0" stroke-opacity="' + f(0.06 + (14 - i) / 14 * 0.6) + '" stroke-width="' + f(2 + (14 - i) / 14 * 9) + '" stroke-linecap="round"/>';
    }
    // 切线方向：没有吸引时的直线路径 + 幽灵月亮 + “下落”楔形
    var rad = deg * Math.PI / 180;
    var tx = -MOON.rx * Math.sin(rad), ty = MOON.ry * Math.cos(rad), tl = Math.hypot(tx, ty);
    tx /= tl; ty /= tl;
    var ahead = 150, gx = m[0] + tx * ahead, gy = m[1] + ty * ahead;
    var real = moonPos(deg + 150 / (Math.PI * (MOON.rx + MOON.ry) / 2) * 180 / Math.PI * 1.0);
    s += '<path d="M' + f(gx) + ' ' + f(gy) + ' L' + f(real[0]) + ' ' + f(real[1]) + ' Q' + f((m[0] + real[0]) / 2) + ' ' + f((m[1] + real[1]) / 2) + ' ' + f(m[0]) + ' ' + f(m[1]) + ' Z" fill="#9fc4ff" fill-opacity="0.16"/>';
    s += '<line x1="' + f(m[0]) + '" y1="' + f(m[1]) + '" x2="' + f(gx) + '" y2="' + f(gy) + '" stroke="#fff3cf" stroke-opacity="0.7" stroke-width="2.4" stroke-dasharray="7 8" stroke-linecap="round"/>';
    s += '<circle cx="' + f(gx) + '" cy="' + f(gy) + '" r="20" fill="#fff3cf" fill-opacity="0.08" stroke="#fff3cf" stroke-opacity="0.45" stroke-width="1.6" stroke-dasharray="4 5"/>';
    // 地球的吸引：从月亮指向地心
    var ex = MOON.cx - m[0], ey = MOON.cy - m[1], el = Math.hypot(ex, ey);
    s += arrow(id, 'g', m[0] + ex / el * 30, m[1] + ey / el * 30, m[0] + ex / el * 128, m[1] + ey / el * 128, 11, (t * 0.9) % 1);
    s += moon(id, m[0], m[1], 24);
    s += label(m[0], m[1] - 40, '月亮', 20);
    return s + '</svg>';
  }

  /* —— 2. 距离标尺（research 11.15 秒起、distance 全段） ——
     深色衬带盖住原片“从地球伸向立方体”的白箭头，衬带上是一把黄铜标尺；
     立方体处的金箭头指向地球，立方体越远，箭头按 1/r² 变短，光点也变慢。 */
  function distanceStrip(cubeLeft, t) {
    var id = 'dist';
    t = t || 0;
    var x0 = 462, x1 = cubeLeft - 6;
    var r0 = 930 - 482, r = cubeLeft - 482;
    var ratio = (r0 * r0) / (r * r);
    var L = 100 * ratio;
    var s = open() + defs(id);
    s += '<linearGradient id="dist-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#0b1220" stop-opacity="0"/><stop offset="4%" stop-color="#0b1220" stop-opacity="0.94"/><stop offset="97%" stop-color="#0b1220" stop-opacity="0.94"/><stop offset="100%" stop-color="#0b1220" stop-opacity="0"/></linearGradient>';
    s += '<rect x="' + x0 + '" y="322" width="' + (x1 - x0 + 4) + '" height="74" rx="14" fill="url(#dist-fade)"/>';
    // 黄铜标尺
    s += '<rect x="' + (x0 + 18) + '" y="364" width="' + (x1 - x0 - 30) + '" height="22" rx="4" fill="#f5ecd6" stroke="#1f1b16" stroke-width="2"/>';
    s += '<rect x="' + (x0 + 20) + '" y="378" width="' + (x1 - x0 - 34) + '" height="6" rx="2" fill="#d6c9a8"/>';
    for (var x = x0 + 30, n = 0; x < x1 - 14; x += 16, n++) {
      s += '<line x1="' + x + '" y1="374" x2="' + x + '" y2="' + (n % 4 ? 380 : 385) + '" stroke="#3a3326" stroke-width="' + (n % 4 ? 1 : 1.6) + '"/>';
    }
    s += '<circle cx="' + (x0 + 18) + '" cy="375" r="9" fill="#c48d3f" stroke="#1f1b16" stroke-width="2"/><circle cx="' + (x0 + 18) + '" cy="375" r="3" fill="#3a3326"/>';
    s += '<circle cx="' + (x1 - 12) + '" cy="375" r="9" fill="#c48d3f" stroke="#1f1b16" stroke-width="2"/><circle cx="' + (x1 - 12) + '" cy="375" r="3" fill="#3a3326"/>';
    // 吸引箭头：从立方体指向地球
    s += arrow(id, 'f', x1 - 4, 343, x1 - 4 - L, 343, 9 * Math.sqrt(ratio), (t * 0.8 * ratio) % 1);
    s += label(x0 + 40, 352, '距离', 18, 'start', 0.85);
    return s + '</svg>';
  }
  function cubeLeftAt(clip, t) {
    if (clip === 'research') return 930;
    var p = Math.max(0, Math.min(1, t / 2.2));
    return 930 + (993 - 930) * p;
  }

  /* —— 3. 相互吸引（reciprocal-explanation 4.2 秒起、ending 前 25 帧） ——
     上排：两个力，各画在受力物体上、彼此相对、等长，中间一枚“＝”徽记，光点沿箭头流向对方；
     下排：运动的变化——苹果一串残影明显移向地球，地球只有几乎看不见的一点。 */
  var MU = { ex: 360, ey: 318, er: 150, ax: 940, ay: 318, ar: 52, L: 150 };
  function mutualPlate(t, part) {
    var id = 'mutual' + (part || '');
    t = t || 0;
    var s = open() + defs(id);
    if (part !== 'dynamic') {
      s += atlas(id, MU.ex, MU.ey);
      s += earth(id, MU.ex, MU.ey, MU.er);
      s += apple(id, MU.ax, MU.ay, MU.ar);
      s += label(MU.ex, MU.ey + MU.er + 40, '地球', 22);
      s += label(MU.ax, MU.ay + MU.ar + 40, '苹果', 22);
      // 下排：运动变化对比的底座
      s += '<line x1="140" y1="560" x2="1140" y2="560" stroke="' + GOLD + '" stroke-opacity="0.25" stroke-width="1" stroke-dasharray="2 6"/>';
      s += label(140, 548, '运动的变化', 16, 'start', 0.7);
      s += note('示意，尺度未按比例');
    }
    if (part === 'static') return s + '</svg>';
    var grow = Math.min(1, t / 0.5);
    var L = MU.L * (0.25 + 0.75 * (1 - Math.pow(1 - grow, 3)));
    var ex0 = MU.ex + MU.er + 10, ax0 = MU.ax - MU.ar - 12;
    s += arrow(id, 'e', ex0, MU.ey, ex0 + L, MU.ey, 14, (t * 0.7) % 1);
    s += arrow(id, 'a', ax0, MU.ay, ax0 - L, MU.ay, 14, (t * 0.7 + 0.25) % 1);
    // “＝”徽记
    var mx = (ex0 + ax0) / 2;
    s += '<circle cx="' + f(mx) + '" cy="' + (MU.ey - 70) + '" r="22" fill="#10192a" stroke="#f6efdc" stroke-width="2"/>';
    s += '<path d="M' + f(mx - 9) + ' ' + (MU.ey - 75) + ' H' + f(mx + 9) + ' M' + f(mx - 9) + ' ' + (MU.ey - 65) + ' H' + f(mx + 9) + '" stroke="' + GOLD + '" stroke-width="3" stroke-linecap="round"/>';
    s += '<path d="M' + f(ex0 + L * 0.5) + ' ' + (MU.ey - 30) + ' Q' + f(mx) + ' ' + (MU.ey - 52) + ' ' + f(ax0 - L * 0.5) + ' ' + (MU.ey - 30) + '" fill="none" stroke="' + GOLD + '" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="3 5"/>';
    // 下排：苹果残影移向地球；地球几乎不动
    var cyc = (t % 2.4) / 2.4;
    for (var i = 0; i < 4; i++) {
      var k = (cyc + i * 0.25) % 1;
      var gx = MU.ax - k * 230;
      s += '<circle cx="' + f(gx) + '" cy="600" r="' + f(14 - k * 4) + '" fill="#d94a35" fill-opacity="' + f(0.15 + (1 - Math.abs(k - 0.5) * 2) * 0.5) + '"/>';
    }
    s += arrow(id, 'am', MU.ax - 20, 600, MU.ax - 250, 600, 6, null);
    s += '<circle cx="' + MU.ex + '" cy="600" r="14" fill="#4f88ab" stroke="#1f1b16" stroke-width="2"/>';
    s += '<circle cx="' + f(MU.ex + 18 + Math.sin(t * 3) * 0.6) + '" cy="600" r="2.4" fill="#fff3cf"/>';
    return s + '</svg>';
  }

  root.FilmPlates = {
    moonPlate: moonPlate,
    distanceStrip: distanceStrip,
    cubeLeftAt: cubeLeftAt,
    mutualPlate: mutualPlate
  };
})(typeof window !== 'undefined' ? window : globalThis);
