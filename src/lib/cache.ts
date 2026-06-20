/**
 * 本地缓存工具 — Electron 下用文件缓存，浏览器下用 localStorage
 */

interface CacheAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, data: any, ttlSeconds?: number) => Promise<boolean>;
  keys: () => Promise<string[]>;
  clear: () => Promise<boolean>;
  getImage: (url: string) => Promise<string | null>;
  saveImage: (url: string) => Promise<string | null>;
  copyToCache: (sourcePath: string) => Promise<string | null>;
  bufferToCache: (buffer: number[], fileName: string) => Promise<string | null>;
  readFileBuffer: (url: string) => Promise<number[] | null>;
  copyToClipboard: (text: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronCache?: CacheAPI;
    electronApp?: {
      version: () => Promise<string>;
      platform: () => Promise<string>;
      openFileDialog: () => Promise<{ originalPath: string; cachedPath: string; fileName: string }[]>;
    };
  }
}

const isElectron = typeof window !== "undefined" && !!window.electronCache;

export const cache = {
  async get(key: string): Promise<any> {
    if (isElectron) return window.electronCache!.get(key);
    try {
      const raw = localStorage.getItem(`av_cache_${key}`);
      if (!raw) return null;
      const { data, expires } = JSON.parse(raw);
      if (expires && Date.now() > expires) { localStorage.removeItem(`av_cache_${key}`); return null; }
      return data;
    } catch { return null; }
  },

  async set(key: string, data: any, ttlSeconds?: number): Promise<boolean> {
    if (isElectron) return window.electronCache!.set(key, data, ttlSeconds);
    try {
      localStorage.setItem(`av_cache_${key}`, JSON.stringify({ data, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null }));
      return true;
    } catch { return false; }
  },

  async keys(): Promise<string[]> {
    if (isElectron) return window.electronCache!.keys();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("av_cache_")) keys.push(k.replace("av_cache_", ""));
    }
    return keys;
  },

  async clear(): Promise<boolean> {
    if (isElectron) return window.electronCache!.clear();
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("av_cache_")) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    return true;
  },
};

/** 带缓存的图片 URL — Electron 下用本地文件，浏览器下用原 URL */
export async function cachedImageUrl(url: string): Promise<string> {
  if (!url) return url;
  // 已经是本地文件，无需缓存
  if (url.startsWith("av-cache://") || url.startsWith("file://")) return url;
  if (isElectron) {
    // 1. Check generic cache (upload-time mapping)
    const genericCached = await window.electronCache!.get(`img_${url}`);
    if (genericCached) return String(genericCached).replace(/^file:\/\/\/?/, "av-cache:///");
    // 2. Check image-specific file cache
    const fileCached = await window.electronCache!.getImage(url);
    if (fileCached) return String(fileCached).replace(/^file:\/\/\/?/, "av-cache:///");
    // 3. Background download
    window.electronCache!.saveImage(url);
  }
  return url;
}

/** 批量预缓存图片 */
export async function preCacheImages(urls: string[]): Promise<void> {
  if (!isElectron) return;
  for (const url of urls) {
    if (!url || url.startsWith("av-cache://") || url.startsWith("file://")) continue;
    window.electronCache!.saveImage(url);
  }
}
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300 // 默认 5 分钟
): Promise<T> {
  const cached = await cache.get(key);
  if (cached) return cached as T;
  const data = await fetcher();
  await cache.set(key, data, ttlSeconds);
  return data;
}
