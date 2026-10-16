// Local preview with byte ranges for the bundled interactive film.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.zip': 'application/zip' };
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(root, '.' + rel);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    let start = 0, end = stat.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      } else start = stat.size;
      if (start > end || start >= stat.size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || !stat.size) return res.end();
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
