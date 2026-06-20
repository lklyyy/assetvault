"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Badge, Spinner, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { CachedImage } from "@/components/assets/cached-image";
import { HighlightedPrompt, type PromptAnnotation } from "@/components/assets/prompt-annotation";
import { decodePromptKey, encodePromptKey, formatDate, stringToColor } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Sparkles, Cpu, Tag, ImageIcon,
  ExternalLink, ChevronRight, Clock, Hash, Sliders,
  Star,
} from "lucide-react";
import type { Asset } from "@/types";

interface ParameterInfo {
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  sampler?: string;
  width?: number;
  height?: number;
  negative_prompt?: string;
}

export default function PromptDetailPage() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const supabase = createClient();

  const prompt = decodePromptKey(key);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Model filter
  const [modelFilter, setModelFilter] = useState("");
  const availableModels = [...new Set(assets.map((a) => a.model).filter(Boolean))] as string[];

  const filteredAssets = modelFilter
    ? assets.filter((a) => a.model === modelFilter)
    : assets;

  useEffect(() => {
    fetchAssets();
    loadPromptMeta();
  }, [key]);

  const fetchAssets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("owner_id", user.id)
      .eq("prompt", prompt)
      .order("created_at", { ascending: false });

    if (error) { toast.error("加载失败"); setLoading(false); return; }
    setAssets((data || []) as Asset[]);

    // Also check shared assets
    const { data: shared } = await supabase
      .from("assets")
      .select("*")
      .neq("owner_id", user.id)
      .eq("prompt", prompt)
      .or(`is_public.eq.true`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (shared?.length) {
      setAssets((prev) => [...prev, ...(shared as Asset[])]);
    }

    setLoading(false);
  };

  const loadPromptMeta = () => {
    // Load favorite/rating/note from localStorage (per prompt)
    const metaKey = `av_prompt_meta_${key}`;
    const raw = localStorage.getItem(metaKey);
    if (raw) {
      try {
        const meta = JSON.parse(raw);
        setIsFavorite(meta.isFavorite || false);
        setRating(meta.rating || 0);
        setNote(meta.note || "");
      } catch {}
    }
  };

  const savePromptMeta = (updates: Partial<{ isFavorite: boolean; rating: number; note: string }>) => {
    const metaKey = `av_prompt_meta_${key}`;
    const raw = localStorage.getItem(metaKey);
    const existing = raw ? JSON.parse(raw) : {};
    const merged = { ...existing, ...updates };
    localStorage.setItem(metaKey, JSON.stringify(merged));
  };

  const toggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    savePromptMeta({ isFavorite: next });
    toast.success(next ? "已收藏" : "已取消收藏");
  };

  const handleRating = (r: number) => {
    setRating(r);
    savePromptMeta({ rating: r });
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    savePromptMeta({ note });
    await new Promise((r) => setTimeout(r, 300));
    toast.success("笔记已保存");
    setSavingNote(false);
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt 已复制");
  };

  const goToAsset = (id: string) => router.push(`/dashboard/assets/${id}`);

  // Parsed parameters across all assets
  const allParams = assets
    .map((a) => (a.parameters as ParameterInfo | null))
    .filter(Boolean) as ParameterInfo[];

  const uniqueParams = new Map<string, Set<string>>();
  for (const p of allParams) {
    for (const [k, v] of Object.entries(p)) {
      if (v == null || v === "") continue;
      if (!uniqueParams.has(k)) uniqueParams.set(k, new Set());
      uniqueParams.get(k)!.add(String(v));
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
        <Spinner className="w-8 h-8 text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex-shrink-0 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0" />
            <span className="truncate">提示词详情</span>
          </h1>
          <p className="text-neutral-500 text-sm mt-1">{assets.length} 张图片 · {availableModels.length} 个模型</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleFavorite}
            className={`p-2 rounded-lg transition-colors ${isFavorite ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-950" : "text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title={isFavorite ? "取消收藏" : "收藏"}
          >
            <Star className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
          </button>
          <button onClick={copyPrompt} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" title="复制 Prompt">
            <Copy className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Prompt text */}
      <Card className="p-5">
        <h3 className="text-sm font-medium text-neutral-500 mb-2 flex items-center gap-1.5">
          <Hash className="w-4 h-4" /> Prompt
        </h3>
        <div className="text-sm leading-relaxed font-mono text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 max-h-48 overflow-y-auto">
          <HighlightedPrompt
            text={prompt}
            annotations={
              ((assets.find(a => (a.parameters as any)?.annotations)?.parameters as any)
                ?.annotations as PromptAnnotation[]) || []
            }
          />
        </div>
      </Card>

      {/* Rating */}
      <Card className="p-4 flex items-center gap-3">
        <span className="text-sm text-neutral-500">评分：</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => handleRating(r)}
              className={`text-xl transition-colors ${r <= rating ? "text-yellow-500" : "text-neutral-300 dark:text-neutral-700 hover:text-yellow-400"}`}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && <span className="text-xs text-neutral-400">{rating}/5</span>}
      </Card>

      {/* Parameters summary */}
      {uniqueParams.size > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-1.5">
            <Sliders className="w-4 h-4" /> 生成参数
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...uniqueParams.entries()].map(([param, values]) => (
              <div key={param} className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3">
                <div className="text-[10px] text-neutral-400 uppercase tracking-wide">{param.replace(/_/g, " ")}</div>
                <div className="text-sm font-mono mt-0.5 text-neutral-700 dark:text-neutral-300">
                  {[...values].slice(0, 3).join(", ")}
                  {values.size > 3 && <span className="text-neutral-400"> +{values.size - 3}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes */}
      <Card className="p-5">
        <h3 className="text-sm font-medium text-neutral-500 mb-2">📝 笔记</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="记录这个提示词的使用心得、调参技巧..."
          rows={3}
          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-y"
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={handleSaveNote} disabled={savingNote}>
            {savingNote ? "保存中..." : "保存笔记"}
          </Button>
        </div>
      </Card>

      {/* Images grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            生成图片 ({filteredAssets.length})
          </h3>
          {availableModels.length > 0 && (
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="text-xs rounded-lg border px-2 py-1.5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700"
            >
              <option value="">🤖 全部模型</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>

        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">没有匹配的图片</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => goToAsset(asset.id)}
                className="group cursor-pointer relative"
              >
                <Card className="overflow-hidden hover:shadow-lg transition-all">
                  <div className="bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center min-h-[120px] relative">
                    {asset.url ? (
                      <CachedImage
                        src={asset.url}
                        alt={asset.title}
                        className="w-full h-auto max-h-[200px] object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-neutral-300" />
                    )}
                    {asset.model && (
                      <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Cpu className="w-2 h-2" />{asset.model}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate">{asset.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {asset.tags?.slice(0, 2).map((t: string) => (
                        <Badge key={t} color={stringToColor(t)}>{t}</Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1">{formatDate(asset.created_at)}</p>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Similar prompts — placeholder, will be enhanced in step 4 */}
      <SimilarPrompts currentPrompt={prompt} excludePrompt={prompt} />
    </div>
  );
}

/** Similar prompts section */
function SimilarPrompts({ currentPrompt, excludePrompt }: { currentPrompt: string; excludePrompt: string }) {
  const supabase = createClient();
  const [similar, setSimilar] = useState<{ prompt: string; count: number; tags: string[] }[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchSimilar();
  }, [currentPrompt]);

  const fetchSimilar = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Extract keywords from current prompt
    const words = currentPrompt
      .toLowerCase()
      .replace(/[,.;:!?，。；：！？\n]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (words.length === 0) return;

    // Also get tags from the current prompt's assets
    const { data: currentAssets } = await supabase
      .from("assets")
      .select("tags")
      .eq("owner_id", user.id)
      .eq("prompt", currentPrompt)
      .limit(10);
    const currentTags = new Set<string>();
    (currentAssets || []).forEach((a: any) => (a.tags || []).forEach((t: string) => currentTags.add(t)));

    // Search for prompts containing any of these keywords
    const conditions = words.map((w) => `prompt.ilike.%${w}%`).join(",");
    const { data } = await supabase
      .from("assets")
      .select("prompt, tags")
      .eq("owner_id", user.id)
      .not("prompt", "is", null)
      .neq("prompt", excludePrompt)
      .or(conditions)
      .limit(30);

    if (!data?.length) return;

    // Group by prompt
    const groups = new Map<string, { count: number; tags: string[] }>();
    for (const a of data as any[]) {
      const p = a.prompt.trim();
      if (!groups.has(p)) groups.set(p, { count: 0, tags: [] });
      const g = groups.get(p)!;
      g.count++;
      (a.tags || []).forEach((t: string) => { if (!g.tags.includes(t)) g.tags.push(t); });
    }

    // Score: keyword overlap + tag overlap
    const scored = [...groups.entries()]
      .map(([prompt, g]) => {
        const pLower = prompt.toLowerCase();
        const kwScore = words.filter((w) => pLower.includes(w)).length;
        const tagOverlap = g.tags.filter((t) => currentTags.has(t)).length;
        const score = kwScore * 2 + tagOverlap; // keywords weighted 2x
        return { prompt, count: g.count, tags: g.tags, score };
      })
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, 6);

    setSimilar(scored);
  };

  if (similar.length === 0) return null;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4" /> 相似提示词
      </h3>
      <div className="space-y-2">
        {similar.map((s) => (
          <div
            key={s.prompt}
            onClick={() => router.push(`/dashboard/prompts/${encodePromptKey(s.prompt)}`)}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate font-mono text-neutral-700 dark:text-neutral-300 group-hover:text-purple-600 transition-colors">
                {s.prompt}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-neutral-400">{s.count} 张图片</span>
                {s.tags.slice(0, 3).map((t) => (
                  <Badge key={t} color={stringToColor(t)}>{t}</Badge>
                ))}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-purple-500 flex-shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );
}
