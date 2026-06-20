"use client";

import { useEffect, useState, useCallback, Suspense, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, Badge, Spinner, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatDate, stringToColor, encodePromptKey } from "@/lib/utils";
import {
  Grid3X3, List, Search, Eye, Users, Filter, X, CheckSquare,
  Square, Trash2, ArrowUpDown, Sparkles, Cpu, Cloud, CloudUpload,
  ZoomIn, ZoomOut, Star,
} from "lucide-react";
import { toast } from "sonner";
import { CachedImage, usePreCache } from "@/components/assets/cached-image";
import type { Asset } from "@/types";

type Tab = "mine" | "shared";
type SortKey = "created_at" | "title" | "view_count";
const MODELS = ["", "Midjourney", "DALL·E 3", "Stable Diffusion XL", "Flux", "DALL·E 2", "Stable Diffusion 3", "ComfyUI", "Firefly", "Imagen"];

export default function GalleryPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8 text-blue-500" /></div>}>
      <GalleryPage />
    </Suspense>
  );
}

function GalleryPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchQuery = searchParams.get("search") || "";
  const tabParam = (searchParams.get("tab") as Tab) || "mine";
  const tagFilter = searchParams.get("tag") || "";
  const modelFilter = searchParams.get("model") || "";
  const favoriteFilter = searchParams.get("favorite") === "1";

  const [assets, setAssets] = useState<Asset[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allModels, setAllModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<Tab>(tabParam);
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ---- 快速预览 ----
  const [quickView, setQuickView] = useState<Asset | null>(null);
  const [quickIndex, setQuickIndex] = useState(0);
  const [quickZoom, setQuickZoom] = useState(1);
  const openQuickView = (asset: Asset, idx: number) => { setQuickView(asset); setQuickIndex(idx); setQuickZoom(1); };
  const closeQuickView = () => setQuickView(null);
  const navQuickView = (dir: -1 | 1) => {
    const next = quickIndex + dir;
    if (next >= 0 && next < assets.length) { setQuickIndex(next); setQuickView(assets[next]); }
  };

  // Esc 关闭、方向键切换
  useEffect(() => {
    if (!quickView) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuickView();
      if (e.key === "ArrowLeft") navQuickView(-1);
      if (e.key === "ArrowRight") navQuickView(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [quickView, quickIndex, assets]);

  // ---- 画廊缩放 (Ctrl+滚轮) ----
  const [gridZoom, setGridZoom] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("av_grid_zoom");
      if (saved) return Number(saved);
    }
    return 50; // 默认中档
  });
  const gridRef = useRef<HTMLDivElement>(null);

  // zoom 0-100 → grid-cols 值
  const zoomToCols = (z: number) => {
    if (z <= 20) return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8";
    if (z <= 40) return "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
    if (z <= 60) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    if (z <= 80) return "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    return "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3";
  };

  const gapByZoom = (z: number) => {
    if (z <= 20) return "gap-2";
    if (z <= 50) return "gap-3";
    if (z <= 75) return "gap-4";
    return "gap-5";
  };

  const handleGridWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setGridZoom((prev) => {
      const next = Math.max(0, Math.min(100, prev - e.deltaY * 0.3));
      localStorage.setItem("av_grid_zoom", String(Math.round(next)));
      return next;
    });
  }, []);

  // Sync a local asset to cloud
  const syncAsset = async (asset: Asset) => {
    const isLocal = asset.url?.startsWith("av-cache://") || asset.url?.startsWith("file://");
    if (!isLocal) return;
    toast.info("同步中...");
    try {
      let blob: Blob;
      // av-cache:// 通过 IPC 读取 → Blob；file:// 用 fetch
      if (asset.url!.startsWith("av-cache://") && window.electronCache?.readFileBuffer) {
        const buf = await window.electronCache.readFileBuffer(asset.url!);
        if (!buf) throw new Error("无法读取本地文件");
        blob = new Blob([new Uint8Array(buf)]);
      } else {
        const resp = await fetch(asset.url!);
        blob = await resp.blob();
      }
      const formData = new FormData();
      formData.append("file", blob, asset.title + ".png");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("请先登录"); return; }
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      formData.append("userId", user.id);
      formData.append("path", path);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) { toast.error("同步失败"); return; }
      const { url: publicUrl } = await uploadRes.json();
      await supabase.from("assets").update({ url: publicUrl, storage_path: path }).eq("id", asset.id);
      toast.success("已同步到云端");
      fetchAssets();
    } catch (e: any) {
      toast.error("同步失败：" + e.message);
    }
  };

  // Pre-cache all visible image URLs
  const assetUrls = assets.map((a) => a.url).filter(Boolean) as string[];
  usePreCache(assetUrls);

  const setTab = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    router.replace(`/dashboard?${params.toString()}`);
  };

  const setParam = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams);
    if (val) params.set(key, val); else params.delete(key);
    router.replace(`/dashboard?${params.toString()}`);
  };

  const buildQuery = useCallback((userId: string, baseQuery: any) => {
    let q = baseQuery;
    if (searchQuery) {
      // Use full-text search style: search across title+prompt+description+tags
      const term = searchQuery.trim();
      q = q.or(`title.ilike.%${term}%,prompt.ilike.%${term}%,description.ilike.%${term}%,tags.cs.{${term}}`);
    }
    if (tagFilter) q = q.contains("tags", [tagFilter]);
    if (modelFilter) q = q.eq("model", modelFilter);
    q = q.order(sortBy, { ascending: sortBy !== "created_at" });
    return q;
  }, [searchQuery, tagFilter, modelFilter, sortBy]);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (activeTab === "mine") {
      let query = buildQuery(user.id, supabase.from("assets").select("*").eq("owner_id", user.id));
      const { data, error } = await query;
      if (!error && data) {
        setAssets(data as Asset[]);
        const tags = new Set<string>(); const models = new Set<string>();
        (data as Asset[]).forEach((a) => { a.tags?.forEach((t) => tags.add(t)); if (a.model) models.add(a.model); });
        setAllTags(Array.from(tags).sort());
        setAllModels(Array.from(models).sort());
      }
    } else {
      const { data: sharedIds } = await supabase.from("asset_shares").select("asset_id").eq("shared_with", user.id);
      if (sharedIds && sharedIds.length > 0) {
        const ids = sharedIds.map((s) => s.asset_id);
        let query = buildQuery(user.id, supabase.from("assets").select("*").in("id", ids));
        const { data, error } = await query;
        if (!error && data) {
          setAssets(data as Asset[]);
          const tags = new Set<string>(); const models = new Set<string>();
          (data as Asset[]).forEach((a) => { a.tags?.forEach((t) => tags.add(t)); if (a.model) models.add(a.model); });
          setAllTags(Array.from(tags).sort());
          setAllModels(Array.from(models).sort());
        }
      } else { setAssets([]); setAllTags([]); setAllModels([]); }
    }
    setLoading(false);
    setSelected(new Set());
  }, [searchQuery, activeTab, supabase, tagFilter, modelFilter, sortBy]);

  // ---- 收藏筛选 ----
  const getFavoritePrompts = (): Set<string> => {
    if (typeof window === "undefined") return new Set();
    const favs = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("av_prompt_meta_")) {
        try {
          const meta = JSON.parse(localStorage.getItem(k)!);
          if (meta.isFavorite) {
            // Extract the prompt key (after the prefix)
            favs.add(k.slice("av_prompt_meta_".length));
          }
        } catch {}
      }
    }
    return favs;
  };

  const displayAssets = useMemo(() => {
    if (!favoriteFilter) return assets;
    const favKeys = getFavoritePrompts();
    return assets.filter((a) => {
      if (!a.prompt) return false;
      try { return favKeys.has(encodePromptKey(a.prompt)); }
      catch { return false; }
    });
  }, [assets, favoriteFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === assets.length) setSelected(new Set());
    else setSelected(new Set(assets.map((a) => a.id)));
  };

  const batchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 个资产？此操作不可撤销。`)) return;
    for (const id of selected) {
      const asset = assets.find((a) => a.id === id);
      if (asset?.storage_path) await supabase.storage.from("assets").remove([asset.storage_path]);
      await supabase.from("assets").delete().eq("id", id);
    }
    toast.success(`已删除 ${selected.size} 个资产`);
    fetchAssets();
    setBatchMode(false);
  };

  // Sync selected local assets
  const batchSync = async () => {
    const toSync = assets.filter((a) => selected.has(a.id) && (a.url?.startsWith("av-cache://") || a.url?.startsWith("file://")));
    if (toSync.length === 0) { toast.info("没有未同步的资产"); return; }
    toast.info(`开始同步 ${toSync.length} 个...`);
    for (const a of toSync) await syncAsset(a);
    toast.success("同步完成");
    setBatchMode(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8 text-blue-500" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 -mx-6 px-6">
        <button onClick={() => setTab("mine")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${activeTab === "mine" ? "border-blue-600 text-blue-600" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>我的资产</button>
        <button onClick={() => setTab("shared")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] flex items-center gap-1.5 ${activeTab === "shared" ? "border-blue-600 text-blue-600" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}><Users className="w-4 h-4" />与我共享</button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-neutral-500">{displayAssets.length} 个资产</p>
          {tagFilter && <Badge color="#3b82f6">{tagFilter}<button onClick={() => setParam("tag", "")} className="ml-1 hover:text-red-500"><X className="w-3 h-3 inline" /></button></Badge>}
          {modelFilter && <Badge color="#8b5cf6"><Cpu className="w-3 h-3 inline mr-0.5" />{modelFilter}<button onClick={() => setParam("model", "")} className="ml-1 hover:text-red-500"><X className="w-3 h-3 inline" /></button></Badge>}
          {searchQuery && <span className="text-xs text-neutral-400">搜索「{searchQuery}」</span>}
          {favoriteFilter && <Badge color="#eab308"><Star className="w-3 h-3 inline mr-0.5" />收藏<button onClick={() => setParam("favorite", "")} className="ml-1 hover:text-red-500"><X className="w-3 h-3 inline" /></button></Badge>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Model filter */}
          {allModels.length > 0 && (
            <select value={modelFilter} onChange={(e) => setParam("model", e.target.value)}
              className="text-xs rounded-lg border px-2 py-1.5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700">
              <option value="">🤖 全部模型</option>
              {allModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="text-xs rounded-lg border px-2 py-1.5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700">
            <option value="created_at">最新优先</option>
            <option value="title">名称排序</option>
            <option value="view_count">浏览量</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-lg border ${showFilters ? "bg-blue-50 border-blue-200 dark:bg-blue-950" : "border-neutral-200 dark:border-neutral-700"}`}>
            <Filter className="w-4 h-4" />
          </button>
          {activeTab === "mine" && (
            <button onClick={() => { setBatchMode(!batchMode); setSelected(new Set()); }}
              className={`p-1.5 rounded-lg border text-xs ${batchMode ? "bg-orange-50 border-orange-200 text-orange-600" : "border-neutral-200 dark:border-neutral-700"}`}>
              <CheckSquare className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode === "grid" ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}><Grid3X3 className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded ${viewMode === "list" ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}><List className="w-4 h-4" /></button>
          </div>
          {/* 缩放控件 */}
          <div className="hidden sm:flex items-center gap-0.5 text-neutral-400 text-xs">
            <button onClick={() => setGridZoom((p) => Math.max(0, p - 15))} className="p-1 hover:text-neutral-600" title="缩小 (Ctrl+滚轮)"><ZoomOut className="w-3.5 h-3.5" /></button>
            <span className="w-8 text-center tabular-nums">{Math.round(gridZoom)}%</span>
            <button onClick={() => setGridZoom((p) => Math.min(100, p + 15))} className="p-1 hover:text-neutral-600" title="放大 (Ctrl+滚轮)"><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Batch bar */}
      {batchMode && selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
          <span className="text-sm font-medium text-orange-700">已选 {selected.size} 个</span>
          <button onClick={selectAll} className="text-xs text-orange-600 hover:underline">{selected.size === assets.length ? "取消全选" : "全选"}</button>
          <div className="flex-1" />
          <Button size="sm" variant="danger" onClick={batchDelete}><Trash2 className="w-3.5 h-3.5" />删除选中</Button>
          <Button size="sm" variant="secondary" onClick={batchSync}><CloudUpload className="w-3.5 h-3.5" />同步选中</Button>
        </div>
      )}

      {/* Tag filters */}
      {showFilters && allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
          {allTags.map((t) => (
            <button key={t} onClick={() => setParam("tag", t === tagFilter ? "" : t)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${t === tagFilter ? "bg-blue-600 text-white" : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300"}`}>{t}</button>
          ))}
        </div>
      )}

      {displayAssets.length === 0 ? (
        <div className="text-center py-20">
          <Search className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium mb-1">{searchQuery || tagFilter || modelFilter ? "没有找到匹配的资产" : activeTab === "shared" ? "还没有人向你共享资产" : "还没有资产"}</h3>
          <p className="text-sm text-neutral-500 mb-4">{searchQuery || tagFilter || modelFilter ? "试试其他关键词或清除筛选" : activeTab === "shared" ? "等待团队成员共享资产给你" : "上传你的第一个 AI 资产吧"}</p>
          {!searchQuery && !tagFilter && !modelFilter && activeTab === "mine" && <Link href="/dashboard/upload"><Button>上传资产</Button></Link>}
        </div>
      ) : (
        <>
          {/* ===== GRID VIEW ===== */}
          {viewMode === "grid" && (
            <div ref={gridRef} onWheel={handleGridWheel}
              className={`grid ${zoomToCols(gridZoom)} ${gapByZoom(gridZoom)} transition-all duration-150`}>
              {displayAssets.map((asset) => (
                <div key={asset.id} className="relative group"
                  onMouseEnter={() => setHoveredId(asset.id)}
                  onMouseLeave={() => setHoveredId(null)}>
                  {batchMode && (
                    <button onClick={(e) => { e.preventDefault(); toggleSelect(asset.id); }}
                      className="absolute top-2 left-2 z-20 w-6 h-6 rounded bg-white/90 dark:bg-neutral-900/90 border shadow-sm flex items-center justify-center">
                      {selected.has(asset.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-neutral-400" />}
                    </button>
                  )}
                  <div onClick={(e) => { e.preventDefault(); openQuickView(asset, assets.indexOf(asset)); }} className="cursor-pointer">
                    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 relative">
                      {/* Image — 原图比例 */}
                      <div className="bg-neutral-100 dark:bg-neutral-900 relative overflow-hidden flex items-center justify-center min-h-[120px]">
                        {asset.type === "image" && asset.url ? (
                          <CachedImage src={asset.url!} alt={asset.title} className="w-full h-auto max-h-[400px] object-contain group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="flex items-center justify-center h-32 text-4xl">{asset.type === "text" ? "📝" : "📄"}</div>
                        )}
                        {/* Prompt overlay on hover */}
                        {asset.prompt && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
                            <p className="text-white text-xs leading-relaxed line-clamp-3 font-medium drop-shadow-sm">{asset.prompt}</p>
                          </div>
                        )}
                        {/* Model badge */}
                        {asset.model && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />{asset.model}
                          </div>
                        )}
                        {/* Sync badge: local only */}
                        {(asset.url?.startsWith("av-cache://") || asset.url?.startsWith("file://")) && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); syncAsset(asset); }}
                            className="absolute bottom-2 right-2 bg-orange-500/80 hover:bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer z-10"
                            title="同步到云端"
                          >
                            <CloudUpload className="w-2.5 h-2.5" />同步
                          </button>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <h4 className="font-medium text-sm truncate">{asset.title}</h4>
                        {!asset.prompt && asset.description && (
                          <p className="text-xs text-neutral-400 truncate mt-0.5">{asset.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {asset.tags?.slice(0, 2).map((t) => <Badge key={t} color={stringToColor(t)}>{t}</Badge>)}
                          {asset.tags && asset.tags.length > 2 && <span className="text-xs text-neutral-400">+{asset.tags.length - 2}</span>}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-2">
                          {formatDate(asset.created_at)}
                          {asset.view_count > 0 && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{asset.view_count}</span>}
                        </p>
                      </div>
                  </Card>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== LIST VIEW ===== */}
          {viewMode === "list" && (
            <div className="space-y-2">
              {displayAssets.map((asset) => (
                <div key={asset.id} onClick={() => openQuickView(asset, assets.indexOf(asset))} className="cursor-pointer">
                  <Card className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow group">
                    <div className="w-20 h-20 rounded-lg bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex-shrink-0">
                      {asset.type === "image" && asset.url ? (
                        <CachedImage src={asset.url!} alt={asset.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-3xl">{asset.type === "text" ? "📝" : "📄"}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{asset.title}</h4>
                        {asset.model && <Badge color="#7c3aed"><Sparkles className="w-2.5 h-2.5 mr-0.5" />{asset.model}</Badge>}
                        {(asset.url?.startsWith("av-cache://") || asset.url?.startsWith("file://")) && (
                          <Badge color="#f97316"><CloudUpload className="w-2.5 h-2.5 mr-0.5 cursor-pointer" onClick={(e) => { e.preventDefault(); syncAsset(asset); }} />未同步</Badge>
                        )}
                      </div>
                      {asset.prompt && <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate mt-1 leading-relaxed">{asset.prompt}</p>}
                      {!asset.prompt && asset.description && <p className="text-xs text-neutral-500 truncate mt-0.5">{asset.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {asset.tags?.slice(0, 4).map((t) => <Badge key={t} color={stringToColor(t)}>{t}</Badge>)}
                        {asset.tags && asset.tags.length > 4 && <span className="text-xs text-neutral-400">+{asset.tags.length - 4}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400 flex-shrink-0 text-right space-y-1">
                      <p>{formatDate(asset.created_at)}</p>
                      {asset.file_size && <p>{Math.round(asset.file_size / 1024)} KB</p>}
                      {asset.view_count > 0 && <p className="flex items-center justify-end gap-0.5"><Eye className="w-3 h-3" />{asset.view_count}</p>}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== 快速预览全屏弹窗 ===== */}
      {quickView && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col" onClick={closeQuickView}>
          <div className="flex items-center gap-4 px-6 py-3 bg-black/60 text-white text-sm" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeQuickView} className="p-1 hover:bg-white/10 rounded">✕ 关闭</button>
            <span className="font-medium truncate flex-1">{quickView.title}</span>
            <span className="text-white/50 text-xs tabular-nums">{Math.round(quickZoom * 100)}%</span>
            <button onClick={() => setQuickZoom((z) => Math.min(5, z + 0.5))} className="p-1 hover:bg-white/10 rounded" title="放大">🔍⁺</button>
            <button onClick={() => setQuickZoom((z) => Math.max(0.25, z - 0.5))} className="p-1 hover:bg-white/10 rounded" title="缩小">🔍⁻</button>
            <button onClick={() => setQuickZoom(1)} className="p-1 hover:bg-white/10 rounded" title="重置">1:1</button>
            <span className="text-white/50">{quickIndex + 1} / {assets.length}</span>
            <button onClick={() => navQuickView(-1)} className="p-1 hover:bg-white/10 rounded disabled:opacity-30" disabled={quickIndex <= 0}>◀</button>
            <button onClick={() => navQuickView(1)} className="p-1 hover:bg-white/10 rounded disabled:opacity-30" disabled={quickIndex >= assets.length - 1}>▶</button>
          </div>
          <div className="flex-1 flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 flex items-center justify-center p-4"
              onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setQuickZoom((z) => Math.max(0.25, Math.min(5, z - e.deltaY * 0.005))); } }}>
              {quickView.type === "image" && quickView.url ? (
                <CachedImage
                  src={quickView.url} alt={quickView.title}
                  className="object-contain rounded-lg select-none"
                  style={{ transform: `scale(${quickZoom})`, transition: "transform 0.1s ease-out", maxWidth: "100%", maxHeight: "85vh" }}
                />
              ) : (
                <div className="text-8xl">{quickView.type === "text" ? "📝" : "📄"}</div>
              )}
            </div>
            <div className="w-80 bg-neutral-900 text-white p-5 space-y-4 overflow-y-auto flex-shrink-0 hidden lg:block">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{quickView.title}</h2>
                <button
                  onClick={async () => {
                    const parts = [quickView.title];
                    if (quickView.prompt) parts.push("提示词: " + quickView.prompt);
                    if (quickView.description && !quickView.prompt) parts.push("描述: " + quickView.description);
                    if (quickView.model) parts.push("模型: " + quickView.model);
                    const text = parts.join("\n");
                    const api = window.electronCache?.copyToClipboard;
                    if (api) await api(text); else await navigator.clipboard.writeText(text);
                    toast.success("已复制");
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >📋 复制全部</button>
              </div>
              {quickView.prompt && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-neutral-400 uppercase tracking-wide">提示词</p>
                    <button
                      onClick={async () => {
                        const text = quickView.prompt!;
                        const api = window.electronCache?.copyToClipboard;
                        if (api) await api(text); else await navigator.clipboard.writeText(text);
                        toast.success("提示词已复制");
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                    >📋 复制</button>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-200">{quickView.prompt}</p>
                </div>
              )}
              {quickView.description && !quickView.prompt && (
                <p className="text-sm leading-relaxed text-neutral-300">{quickView.description}</p>
              )}
              {quickView.model && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">模型</span>
                  <Badge color="#a855f7">{quickView.model}</Badge>
                </div>
              )}
              {quickView.tags && quickView.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {quickView.tags.map((t) => <Badge key={t} color={stringToColor(t)}>{t}</Badge>)}
                </div>
              )}
              <div className="text-xs text-neutral-500 space-y-1 pt-2 border-t border-neutral-800">
                {quickView.width && quickView.height && <p>尺寸 {quickView.width}×{quickView.height}</p>}
                {quickView.file_size && <p>大小 {Math.round(quickView.file_size / 1024)} KB</p>}
                <p>创建 {formatDate(quickView.created_at)}</p>
                {quickView.view_count > 0 && <p>浏览 {quickView.view_count} 次</p>}
              </div>
              <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/assets/${quickView.id}`)} className="w-full mt-2">
                查看完整详情
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
