"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Badge, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { CachedImage } from "@/components/assets/cached-image";
import { formatDate, stringToColor } from "@/lib/utils";
import { Globe, Sparkles, Cpu, Eye, MessageCircle, Star } from "lucide-react";
import type { Asset } from "@/types";

export default function ExplorePageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8 text-blue-500" /></div>}>
      <ExplorePage />
    </Suspense>
  );
}

function ExplorePage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tagFilter = searchParams.get("tag") || "";
  const modelFilter = searchParams.get("model") || "";

  const [assets, setAssets] = useState<Asset[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allModels, setAllModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAssets(); }, [tagFilter, modelFilter]);

  const fetchAssets = async () => {
    setLoading(true);
    let query = supabase
      .from("assets")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(200);

    if (tagFilter) query = query.contains("tags", [tagFilter]);
    if (modelFilter) query = query.eq("model", modelFilter);

    const { data, error } = await query;
    if (error) { setLoading(false); return; }

    const assetList = (data || []) as Asset[];

    // 单独查询所有 owner 的显示名
    const ownerIds = [...new Set(assetList.map(a => a.owner_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", ownerIds);
    const nameMap = new Map<string, string>();
    (profiles || []).forEach((p: any) => {
      nameMap.set(p.id, p.display_name || p.email?.split("@")[0] || "用户");
    });

    // 给每个 asset 附上作者名
    const enriched = assetList.map(a => ({
      ...a,
      _authorName: nameMap.get(a.owner_id) || "用户",
    }));

    setAssets(enriched as any);

    // Collect tags & models
    const tags = new Set<string>();
    const models = new Set<string>();
    for (const a of assetList) {
      a.tags?.forEach((t: string) => tags.add(t));
      if (a.model) models.add(a.model);
    }
    setAllTags([...tags]);
    setAllModels([...models]);
    setLoading(false);
  };

  // Rating from localStorage
  const getRating = (assetId: string): number => {
    try {
      const raw = localStorage.getItem(`av_rating_${assetId}`);
      return raw ? parseInt(raw) : 0;
    } catch { return 0; }
  };

  const setRating = (assetId: string, r: number) => {
    localStorage.setItem(`av_rating_${assetId}`, String(r));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6 text-emerald-500" />发现</h1></div>
        </div>
        <div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8 text-emerald-500" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-500" />发现
          </h1>
          <p className="text-neutral-500 text-sm mt-1">{assets.length} 张公开作品</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {allModels.length > 0 && (
            <select
              value={modelFilter}
              onChange={(e) => {
                const p = new URLSearchParams(searchParams);
                if (e.target.value) p.set("model", e.target.value); else p.delete("model");
                router.replace(`/dashboard/explore?${p.toString()}`);
              }}
              className="text-xs rounded-lg border px-2 py-1.5 bg-white dark:bg-neutral-900"
            >
              <option value="">🤖 全部模型</option>
              {allModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.slice(0, 20).map((t) => (
            <button
              key={t}
              onClick={() => {
                const p = new URLSearchParams(searchParams);
                if (tagFilter === t) p.delete("tag"); else p.set("tag", t);
                router.replace(`/dashboard/explore?${p.toString()}`);
              }}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                tagFilter === t
                  ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {assets.length === 0 ? (
        <div className="text-center py-20 text-neutral-400">
          <Globe className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium mb-1">还没有公开作品</h3>
          <p className="text-sm">快去上传并在设置中公开你的作品吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {assets.map((asset: any) => {
            const rating = getRating(asset.id);
            const authorName = asset._authorName || "用户";
            return (
              <div key={asset.id} className="group cursor-pointer" onClick={() => router.push(`/dashboard/assets/${asset.id}`)}>
                <Card className="overflow-hidden hover:shadow-lg transition-all h-full">
                  <div className="bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center min-h-[120px] relative">
                    {asset.url ? (
                      <CachedImage src={asset.url} alt={asset.title} className="w-full h-auto max-h-[200px] object-contain group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="text-4xl">🖼️</div>
                    )}
                    {asset.model && (
                      <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Cpu className="w-2 h-2" />{asset.model}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    <p className="text-xs font-medium truncate">{asset.title}</p>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                      <span>{authorName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {asset.tags?.slice(0, 2).map((t: string) => (
                        <Badge key={t} color={stringToColor(t)}>{t}</Badge>
                      ))}
                      <div className="flex items-center gap-2 ml-auto">
                        {/* Rating stars */}
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <button
                              key={r}
                              onClick={(ev) => { ev.stopPropagation(); setRating(asset.id, r); fetchAssets(); }}
                              className={`text-xs ${r <= rating ? "text-yellow-500" : "text-neutral-300 hover:text-yellow-400"}`}
                            >★</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
