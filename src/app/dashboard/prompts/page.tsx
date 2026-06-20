"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Spinner, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cachedQuery } from "@/lib/cache";
import { CachedImage } from "@/components/assets/cached-image";
import { formatDate, encodePromptKey, stringToColor } from "@/lib/utils";
import { Search, Copy, ImageIcon, Sparkles, ChevronRight, ChevronDown, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";

interface PromptGroup {
  prompt: string;
  count: number;
  models: string[];
  tags: string[];
  previews: string[];
  latestDate: string;
}

const PAGE_SIZE = 50;

export default function PromptsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [allGroups, setAllGroups] = useState<PromptGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"rating" | "count" | "date">("rating");

  const getPromptRating = (promptText: string): number => {
    if (typeof window === "undefined") return 0;
    try {
      const key = `av_prompt_meta_${encodePromptKey(promptText)}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const meta = JSON.parse(raw);
        return meta.rating || 0;
      }
    } catch {}
    return 0;
  };

  const fetchPage = useCallback(async (pageNum: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const cacheKey = `prompts_${user.id}_p${pageNum}`;
    const raw = await cachedQuery(cacheKey, async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("prompt,model,tags,url,created_at")
        .eq("owner_id", user.id)
        .not("prompt", "is", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error || !data) return [];
      return data;
    }, 120);
    if (!raw || raw.length === 0) { setHasMore(false); return; }
    if (raw.length < PAGE_SIZE) setHasMore(false);
    const groups: PromptGroup[] = [];
    const seen = new Set<string>();
    for (const a of raw as any[]) {
      if (!a.prompt) continue;
      const key = a.prompt.trim();
      if (seen.has(key)) {
        const g = groups.find((g) => g.prompt === key)!;
        g.count++;
        if (a.model && !g.models.includes(a.model)) g.models.push(a.model);
        a.tags?.forEach((t: string) => { if (!g.tags.includes(t)) g.tags.push(t); });
        if (g.previews.length < 3 && a.url) g.previews.push(a.url);
        if (a.created_at > g.latestDate) g.latestDate = a.created_at;
      } else {
        seen.add(key);
        groups.push({
          prompt: key, count: 1,
          models: a.model ? [a.model] : [],
          tags: a.tags || [],
          previews: a.url ? [a.url] : [],
          latestDate: a.created_at,
        });
      }
    }
    setAllGroups((prev) => {
      const existingKeys = new Set(prev.map((g) => g.prompt));
      return [...prev, ...groups.filter((g) => !existingKeys.has(g.prompt))];
    });
  }, [supabase]);

  useEffect(() => {
    setLoading(true); setPage(0); setAllGroups([]); setHasMore(true);
    fetchPage(0).then(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchPage(nextPage);
  };

  const sortedGroups = useMemo(() => {
    const groups = [...allGroups];
    if (sortBy === "rating") {
      return groups.sort((a, b) => {
        const ra = getPromptRating(a.prompt);
        const rb = getPromptRating(b.prompt);
        if (rb !== ra) return rb - ra;
        return b.count - a.count;
      });
    }
    if (sortBy === "date") {
      return groups.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
    }
    return groups.sort((a, b) => b.count - a.count);
  }, [allGroups, sortBy]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return sortedGroups;
    const q = search.toLowerCase();
    return sortedGroups.filter(
      (g) => g.prompt.toLowerCase().includes(q) ||
        g.models.some((m) => m.toLowerCase().includes(q)) ||
        g.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [sortedGroups, search]);

  const copyPrompt = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("已复制");
  };

  const viewAssets = (prompt: string) => {
    router.push(`/dashboard?search=${encodeURIComponent(prompt)}`);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-purple-500" />提示词库</h1></div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="flex gap-1.5"><div className="w-16 h-16 rounded-lg bg-neutral-200 dark:bg-neutral-800" /></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
                  <div className="h-3 bg-neutral-100 dark:bg-neutral-900 rounded w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (sortedGroups.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-purple-500" />提示词库</h1>
          <p className="text-neutral-500 text-sm mt-1">上传资产时填写 prompt，这里会自动汇集整理</p>
        </div>
        <div className="text-center py-20">
          <Search className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium mb-1">还没有收录提示词</h3>
          <p className="text-sm text-neutral-500 mb-4">上传 AI 图片时记得填写 prompt 字段</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-purple-500" />提示词库</h1>
          <p className="text-neutral-500 text-sm mt-1">{sortedGroups.length} 个提示词</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs rounded-lg border px-2 py-1.5 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700"
          >
            <option value="rating">⭐ 评分最高</option>
            <option value="count">🔥 使用最多</option>
            <option value="date">🕐 最近使用</option>
          </select>
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="搜索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredGroups.map((group) => {
          const rating = getPromptRating(group.prompt);
          return (
            <Card key={group.prompt} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex gap-1.5 flex-shrink-0">
                    {group.previews.length > 0 ? (
                      group.previews.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                      ))
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-neutral-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-relaxed font-mono text-neutral-700 dark:text-neutral-300 cursor-pointer hover:text-purple-600 transition-colors ${expandedPrompt === group.prompt ? "" : "line-clamp-2"}`}
                        onClick={() => setExpandedPrompt(expandedPrompt === group.prompt ? null : group.prompt)}
                        title="点击展开/收起"
                      >
                        {group.prompt}
                      </p>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => copyPrompt(group.prompt)} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800" title="复制">
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                        <button onClick={() => viewAssets(group.prompt)} className="p-1.5 rounded hover:bg-purple-50 text-purple-600" title="在画廊中查看图片">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => router.push(`/dashboard/prompts/${encodePromptKey(group.prompt)}`)} className="p-1.5 rounded hover:bg-purple-50 text-purple-600" title="查看提示词详情">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {rating > 0 && (
                        <span className="text-xs font-medium text-yellow-600 bg-yellow-50 dark:bg-yellow-950/50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />{rating}
                        </span>
                      )}
                      <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full">
                        {group.count} 张图片
                      </span>
                      {group.models.map((m) => (
                        <Badge key={m} color="#7c3aed"><Sparkles className="w-2.5 h-2.5 mr-0.5" />{m}</Badge>
                      ))}
                      {group.tags.slice(0, 3).map((t) => (
                        <Badge key={t} color={stringToColor(t)}>{t}</Badge>
                      ))}
                      {group.tags.length > 3 && <span className="text-xs text-neutral-400">+{group.tags.length - 3}</span>}
                      <span className="text-xs text-neutral-400 ml-auto">{formatDate(group.latestDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {hasMore && filteredGroups.length === sortedGroups.length && (
        <div className="text-center py-4">
          <Button variant="secondary" onClick={loadMore} className="gap-1">
            <ChevronDown className="w-4 h-4" />加载更多
          </Button>
        </div>
      )}

      {filteredGroups.length === 0 && search && (
        <div className="text-center py-12 text-neutral-400">没有匹配「{search}」的提示词</div>
      )}
    </div>
  );
}
