import { GAME_MODULE_LIMITS } from "./game-module.mjs";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const ARCHIVE_SUFFIX = /\.(?:zip|rar|7z|tar|gz|bz2|xz)$/i;

function fail(message) { throw new Error(message); }
function safePath(path) {
  return path
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.includes("\0")
    && !/^[A-Za-z]:/.test(path)
    && !path.split("/").some((part) => part === "" || part === "." || part === "..");
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    table[value] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") fail("当前浏览器不支持安全解压 ZIP，请使用最新版 Chrome、Edge 或 Safari");
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    fail("ZIP 解压失败，请用最新版 Skill 重新导出，不要二次压缩");
  }
}

function contentType(path) {
  if (/\.json$/i.test(path)) return "application/json";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.webp$/i.test(path)) return "image/webp";
  if (/\.woff2$/i.test(path)) return "font/woff2";
  if (/\.ttf$/i.test(path)) return "font/ttf";
  if (/\.wav$/i.test(path)) return "audio/wav";
  if (/\.mp3$/i.test(path)) return "audio/mpeg";
  if (/\.ogg$/i.test(path)) return "audio/ogg";
  return "application/octet-stream";
}

export async function filesFromZip(zipFile) {
  if (!zipFile || zipFile.size > GAME_MODULE_LIMITS.maxZipBytes) fail("ZIP 不能超过 50MB");
  const bytes = new Uint8Array(await zipFile.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const minimum = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD) { eocd = offset; break; }
  }
  if (eocd < 0) fail("不是有效的 ZIP 文件");
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (disk || centralDisk || entriesOnDisk !== entryCount || entryCount === 0xffff || centralOffset === 0xffffffff) fail("不支持分卷或 ZIP64 压缩包");
  if (entryCount > GAME_MODULE_LIMITS.maxFiles) fail(`ZIP 文件过多：最多 ${GAME_MODULE_LIMITS.maxFiles} 个`);

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const records = [];
  let offset = centralOffset;
  let expandedTotal = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL) fail("ZIP 中央目录损坏");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const checksum = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const expandedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (flags & 0x1) fail("不接受加密 ZIP");
    if (![0, 8].includes(method)) fail("ZIP 使用了不支持的压缩算法");
    let path;
    try { path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)); }
    catch { fail("ZIP 文件名必须使用 UTF-8 编码"); }
    offset += 46 + nameLength + extraLength + commentLength;
    if (path.endsWith("/") || path.startsWith("__MACOSX/") || path.endsWith("/.DS_Store") || path === ".DS_Store") continue;
    if (!safePath(path)) fail(`ZIP 含不安全路径：${path}`);
    if (ARCHIVE_SUFFIX.test(path)) fail(`ZIP 内不能再放压缩包：${path}`);
    if (expandedSize > GAME_MODULE_LIMITS.maxFileBytes) fail(`单个文件超过 20MB：${path}`);
    expandedTotal += expandedSize;
    if (expandedTotal > GAME_MODULE_LIMITS.maxExpandedBytes) fail("ZIP 解压后内容超过 100MB");
    records.push({ path, method, checksum, compressedSize, expandedSize, localOffset });
  }

  const seen = new Set();
  const files = [];
  for (const record of records) {
    if (seen.has(record.path)) fail(`ZIP 含重复路径：${record.path}`);
    seen.add(record.path);
    const base = record.localOffset;
    if (base + 30 > bytes.length || view.getUint32(base, true) !== LOCAL) fail(`ZIP 文件头损坏：${record.path}`);
    const nameLength = view.getUint16(base + 26, true);
    const extraLength = view.getUint16(base + 28, true);
    const start = base + 30 + nameLength + extraLength;
    const end = start + record.compressedSize;
    if (end > bytes.length) fail(`ZIP 文件内容损坏：${record.path}`);
    const compressed = bytes.slice(start, end);
    const data = record.method === 0 ? compressed : await inflateRaw(compressed);
    if (data.length !== record.expandedSize || crc32(data) !== record.checksum) fail(`ZIP 校验失败：${record.path}`);
    const file = new File([data], record.path.split("/").pop(), { type: contentType(record.path) });
    Object.defineProperty(file, "webkitRelativePath", { value: record.path });
    files.push(file);
  }
  if (files.length === 0) fail("ZIP 里没有可导入的文件");
  return files;
}
