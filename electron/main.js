const { app, BrowserWindow, shell, ipcMain, Menu, dialog, protocol, net, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let nextServer;

const isDev = !app.isPackaged;
const PORT = 3000;

// Local cache directory
const cacheDir = path.join(app.getPath("userData"), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

const imagesDir = path.join(cacheDir, "images");
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

// av-cache helper
function toAvCache(absPath) {
  return `av-cache:///${absPath.replace(/\\/g, "/")}`;
}
function fromAvCache(url) {
  return decodeURIComponent(url.replace(/^(av-cache|file):\/\/\//, ""));
}

// ---- Window ----
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "AssetVault — 本地 AI 资产管理",
    icon: path.join(__dirname, "../public/icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // 注册 av-cache:// 协议
  try {
    protocol.handle("av-cache", (request) => {
      const raw = decodeURIComponent(request.url.slice("av-cache:///".length));
      const absPath = raw.replace(/\\/g, "/");
      return net.fetch(`file:///${absPath}`);
    });
  } catch (e) {
    console.error("av-cache protocol registration failed:", e.message);
  }

  // 防止页面内跳转打开外部浏览器（例如 OAuth 回调）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 允许同源页面在窗口内打开
    if (url.startsWith(`http://localhost:${PORT}`) || url.startsWith("av-cache://")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 页面加载失败时不崩溃，重试
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`Page load failed: ${errorCode} - ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }
    }, 1000);
  });

  // 捕获未处理的渲染进程崩溃
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Render process gone:", details.reason);
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // 注入 CSS 标记桌面版（在窗口标题栏加标识）
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.executeJavaScript(`
      document.title = "AssetVault 桌面版";
      // 在 body 上加 data 属性标记桌面端
      document.body.setAttribute("data-electron", "true");
    `);
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ---- Start Next.js server (dev & packaged) ----
function startNextServer() {
  return new Promise((resolve, reject) => {
    // 先检查端口是否已被占用（比如用户已手动启动了 npm run start）
    const check = require("child_process").execSync(
      `netstat -ano | findstr :${PORT}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).toString();
    if (check.includes("LISTENING")) {
      console.log(`Port ${PORT} already in use, reusing existing server`);
      resolve(null);
      return;
    }

    const { spawn } = require("child_process");
    const isWin = process.platform === "win32";

    if (!isDev) {
      // 打包模式
      const server = spawn("node", [".next/standalone/server.js"], {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, PORT: String(PORT) },
        stdio: "pipe",
      });
      server.stderr.on("data", (d) => process.stderr.write(d));
      server.stdout.on("data", (d) => {
        process.stdout.write(d);
        if (d.toString().includes("Ready")) resolve(server);
      });
      server.on("error", reject);
      nextServer = server;
    } else {
      // 开发模式：用 cmd /c 避免 shell:true 的警告
      const isWin = process.platform === "win32";
      const cmd = isWin ? "cmd" : "npx";
      const args = isWin
        ? ["/c", "npx", "next", "start"]
        : ["next", "start"];
      const server = spawn(cmd, args, {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, PORT: String(PORT) },
        stdio: "pipe",
      });
      server.stderr.on("data", (d) => process.stderr.write(d));
      server.stdout.on("data", (d) => {
        process.stdout.write(d);
        const s = d.toString();
        if (s.includes("Ready") || s.includes("localhost")) resolve(server);
      });
      setTimeout(() => resolve(server), 8000);
      server.on("error", reject);
      nextServer = server;
    }
  });
}

// ---- IPC: Cache ----
function cachePath(key) {
  return path.join(cacheDir, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

ipcMain.handle("cache:get", (_event, key) => {
  try {
    const p = cachePath(key);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    const { data, expires } = JSON.parse(raw);
    if (expires && Date.now() > expires) { fs.unlinkSync(p); return null; }
    return data;
  } catch { return null; }
});

ipcMain.handle("cache:set", (_event, key, data, ttlSeconds) => {
  try {
    const p = cachePath(key);
    const payload = { data, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null };
    fs.writeFileSync(p, JSON.stringify(payload), "utf-8");
    return true;
  } catch { return false; }
});

ipcMain.handle("cache:keys", () => {
  try {
    return fs.readdirSync(cacheDir).map((f) => f.replace(".json", ""));
  } catch { return []; }
});

ipcMain.handle("cache:clear", () => {
  try {
    fs.readdirSync(cacheDir).forEach((f) => fs.unlinkSync(path.join(cacheDir, f)));
    return true;
  } catch { return false; }
});

ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-platform", () => process.platform);
ipcMain.handle("clipboard:copy", (_event, text) => { clipboard.writeText(text); return true; });

// ---- IPC: Image cache & file ops ----
ipcMain.handle("cache:get-image", (_event, url) => {
  const file = cacheImageFile(url);
  if (fs.existsSync(file)) return toAvCache(file);
  return null;
});

ipcMain.handle("cache:save-image", (_event, url) => {
  return new Promise((resolve) => {
    const file = cacheImageFile(url);
    if (fs.existsSync(file)) { resolve(toAvCache(file)); return; }

    if (url.startsWith("av-cache://") || url.startsWith("file://")) {
      try {
        const src = fromAvCache(url);
        if (fs.existsSync(src)) { fs.copyFileSync(src, file); resolve(toAvCache(file)); }
        else resolve(url);
      } catch { resolve(url); }
      return;
    }

    const proto = url.startsWith("https") ? require("https") : require("http");
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        resolve(ipcMain.emit("cache:save-image", _event, redirectUrl));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        fs.writeFileSync(file, Buffer.concat(chunks));
        resolve(toAvCache(file));
      });
    }).on("error", () => resolve(null));
  });
});

function cacheImageKey(url) {
  const hash = require("crypto").createHash("md5").update(url).digest("hex");
  const ext = url.split(".").pop()?.split("?")[0] || "jpg";
  return { hash, ext, file: path.join(imagesDir, `${hash}.${ext}`) };
}
function cacheImageFile(url) { return cacheImageKey(url).file; }

ipcMain.handle("dialog:open-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择 AI 生成的图片",
    filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp"] }],
    properties: ["openFile", "multiSelections"],
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  const cached = [];
  for (const fp of result.filePaths) {
    const ext = path.extname(fp) || ".png";
    const hash = require("crypto").createHash("md5").update(fp + Date.now()).digest("hex");
    const dest = path.join(imagesDir, `${hash}${ext}`);
    fs.copyFileSync(fp, dest);
    cached.push({ originalPath: fp, cachedPath: toAvCache(dest), fileName: path.basename(fp) });
  }
  return cached;
});

ipcMain.handle("file:copy-to-cache", (_event, sourcePath) => {
  try {
    if (!fs.existsSync(sourcePath)) return null;
    const ext = path.extname(sourcePath) || ".png";
    const destName = `${require("crypto").createHash("md5").update(sourcePath + Date.now()).digest("hex")}${ext}`;
    const destPath = path.join(imagesDir, destName);
    fs.copyFileSync(sourcePath, destPath);
    return toAvCache(destPath);
  } catch (e) { return null; }
});

ipcMain.handle("file:buffer-to-cache", (_event, buffer, fileName) => {
  try {
    const ext = path.extname(fileName || ".png") || ".png";
    const hash = require("crypto").createHash("md5").update(Date.now().toString() + Math.random()).digest("hex");
    const dest = path.join(imagesDir, `${hash}${ext}`);
    fs.writeFileSync(dest, Buffer.from(buffer));
    return toAvCache(dest);
  } catch { return null; }
});

ipcMain.handle("file:read-buffer", (_event, url) => {
  try {
    const absPath = fromAvCache(url);
    if (!fs.existsSync(absPath)) return null;
    return Array.from(fs.readFileSync(absPath));
  } catch { return null; }
});

// ---- App menu ----
const isMac = process.platform === "darwin";
const menuTemplate = [
  ...(isMac ? [{
    label: "AssetVault",
    submenu: [
      { label: "关于 AssetVault", role: "about" },
      { type: "separator" },
      { label: "退出", accelerator: "CmdOrCtrl+Q", role: "quit" },
    ],
  }] : []),
  {
    label: "文件",
    submenu: [
      { label: "新窗口", accelerator: "CmdOrCtrl+N", click: () => createWindow() },
      { type: "separator" },
      { label: "退出", accelerator: isMac ? "Cmd+Q" : "Alt+F4", role: "quit" },
    ],
  },
  {
    label: "编辑",
    submenu: [
      { label: "撤销", accelerator: "CmdOrCtrl+Z", role: "undo" },
      { label: "重做", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
      { type: "separator" },
      { label: "剪切", accelerator: "CmdOrCtrl+X", role: "cut" },
      { label: "复制", accelerator: "CmdOrCtrl+C", role: "copy" },
      { label: "粘贴", accelerator: "CmdOrCtrl+V", role: "paste" },
      { label: "全选", accelerator: "CmdOrCtrl+A", role: "selectAll" },
    ],
  },
  {
    label: "视图",
    submenu: [
      { label: "重新加载", accelerator: "CmdOrCtrl+R", role: "reload" },
      { label: "开发者工具", accelerator: "F12", role: "toggleDevTools" },
      { type: "separator" },
      { label: "全屏", accelerator: "F11", role: "togglefullscreen" },
    ],
  },
];

// ---- Lifecycle ----
app.whenReady().then(async () => {
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  await startNextServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (nextServer) nextServer.kill();
  if (process.platform !== "darwin") app.quit();
});
