const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronCache", {
  get: (key) => ipcRenderer.invoke("cache:get", key),
  set: (key, data, ttlSeconds) => ipcRenderer.invoke("cache:set", key, data, ttlSeconds),
  keys: () => ipcRenderer.invoke("cache:keys"),
  clear: () => ipcRenderer.invoke("cache:clear"),
  getImage: (url) => ipcRenderer.invoke("cache:get-image", url),
  saveImage: (url) => ipcRenderer.invoke("cache:save-image", url),
  copyToCache: (sourcePath) => ipcRenderer.invoke("file:copy-to-cache", sourcePath),
  bufferToCache: (buffer, fileName) => ipcRenderer.invoke("file:buffer-to-cache", buffer, fileName),
  readFileBuffer: (url) => ipcRenderer.invoke("file:read-buffer", url),
  copyToClipboard: (text) => ipcRenderer.invoke("clipboard:copy", text),
});

contextBridge.exposeInMainWorld("electronApp", {
  version: () => ipcRenderer.invoke("get-app-version"),
  platform: () => ipcRenderer.invoke("get-platform"),
  openFileDialog: () => ipcRenderer.invoke("dialog:open-files"),
});
