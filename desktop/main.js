// Pembungkus Windows (Electron) untuk GLOBAL STOCK CONTROL.
// Folder "out" (hasil `npm run build:static`) disajikan lewat server lokal http://localhost:PORT
// supaya: (1) asal halaman = "localhost" (sudah terdaftar di Firebase Authentication),
// (2) data login tersimpan tetap antar-peluncuran (port dibuat tetap).
const { app, BrowserWindow, Menu, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'out');
const PORT = 38417;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function resolveFile(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const full = path.normalize(path.join(ROOT, p));
  if (!full.startsWith(ROOT)) return null; // cegah akses di luar folder out
  const tries = [full, path.join(full, 'index.html'), `${full}.html`];
  for (const t of tries) {
    if (fs.existsSync(t) && fs.statSync(t).isFile()) return t;
  }
  // rute tanpa ekstensi yang tidak ditemukan -> halaman utama
  if (!path.extname(p)) return path.join(ROOT, 'index.html');
  return null;
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const file = resolveFile(req.url || '/');
      if (!file) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  let port;
  try {
    port = await startServer(PORT);
  } catch {
    port = await startServer(0); // port tetap dipakai program lain -> pakai port acak
  }
  const win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'GLOBAL STOCK CONTROL - BISNIS HOTEL',
    backgroundColor: '#0B1426',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL(`http://localhost:${port}/`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow);
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });
  app.on('window-all-closed', () => app.quit());
}
