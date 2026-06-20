"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Badge, Button, Spinner, Input, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatFileSize, stringToColor } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Download, Copy, Edit3, Trash2, Eye,
  Calendar, Cpu, FileText, Tag, Share2,
} from "lucide-react";
import { ShareModal } from "@/components/assets/share-modal";
import { CachedImage } from "@/components/assets/cached-image";
import { ZoomableImage } from "@/components/assets/zoomable-image";
import { PromptAnnotationEditor, HighlightedPrompt, type PromptAnnotation } from "@/components/assets/prompt-annotation";
import { CommentSection } from "@/components/assets/comment-section";
import type { Asset } from "@/types";

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editModel, setEditModel] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editAnnotations, setEditAnnotations] = useState<PromptAnnotation[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { fetchAsset(); checkAdmin(); }, [id]);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Check profiles for is_admin
    const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (data?.is_admin) setIsAdmin(true);
  };

  const fetchAsset = async () => {
    const { data, error } = await supabase.from("assets").select("*").eq("id", id).single();
    if (error || !data) { toast.error("资产不存在"); router.push("/dashboard"); return; }
    const a = data as Asset;
    setAsset(a);
    setEditTitle(a.title);
    setEditDescription(a.description || "");
    setEditPrompt(a.prompt || "");
    setEditModel(a.model || "");
    setEditTags(a.tags || []);
    const params = a.parameters as Record<string, any> | null;
    setEditAnnotations(params?.annotations || []);
    await supabase.from("assets").update({ view_count: a.view_count + 1 }).eq("id", id);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!asset) return;
    const { error } = await supabase.from("assets").update({
      title: editTitle, description: editDescription || null,
      prompt: editPrompt || null, model: editModel || null, tags: editTags,
      parameters: editAnnotations.length > 0 ? { annotations: editAnnotations } : null,
    }).eq("id", asset.id);
    if (error) toast.error("保存失败");
    else {
      toast.success("已保存");
      setAsset({ ...asset, title: editTitle, description: editDescription || null, prompt: editPrompt || null, model: editModel || null, tags: editTags, parameters: editAnnotations.length > 0 ? { annotations: editAnnotations } as any : null });
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!asset || !confirm("确定删除？不可撤销。")) return;
    if (asset.storage_path) await supabase.storage.from("assets").remove([asset.storage_path]);
    await supabase.from("assets").delete().eq("id", asset.id);
    toast.success("已删除");
    router.push("/dashboard");
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !editTags.includes(t)) { setEditTags([...editTags, t]); setTagInput(""); }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("已复制");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8 text-blue-500" /></div>;
  if (!asset) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="w-4 h-4" />返回
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {asset.type === "image" && asset.url && (
            <ZoomableImage src={asset.url} alt={asset.title} />
          )}
          {asset.type === "text" && asset.text_content && (
            <Card className="p-6"><div className="whitespace-pre-wrap">{asset.text_content}</div></Card>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {asset.model && <InfoCard icon={Cpu} label="模型" value={asset.model} />}
            {asset.width && asset.height && <InfoCard icon={Eye} label="尺寸" value={`${asset.width}×${asset.height}`} />}
            {asset.file_size && <InfoCard icon={FileText} label="大小" value={formatFileSize(asset.file_size)} />}
            <InfoCard icon={Calendar} label="创建" value={formatDate(asset.created_at)} />
          </div>
        </div>

        <div className="space-y-4">
          {editing ? (
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">编辑资产</h3>
              <Input label="标题" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">Prompt</label>
                <PromptAnnotationEditor
                  value={editPrompt}
                  onChange={setEditPrompt}
                  annotations={editAnnotations}
                  onAnnotationsChange={setEditAnnotations}
                  placeholder="Prompt..."
                  rows={4}
                />
              </div>
              <Input label="模型" value={editModel} onChange={(e) => setEditModel(e.target.value)} />
              <Textarea label="描述" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              <div>
                <label className="text-sm font-medium block mb-1">标签</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editTags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 text-xs">
                      {t}<button onClick={() => setEditTags(editTags.filter((x) => x !== t))}>×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input type="text" placeholder="添加标签" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    className="flex-1 rounded-md border px-2 py-1 text-xs" />
                  <Button size="sm" variant="secondary" onClick={addTag}>+</Button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave}>保存</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>取消</Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{asset.title}</h2>
                <div className="flex gap-1">
                  <button onClick={() => setShareOpen(true)} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800" title="共享">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800" title="编辑">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="删除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {asset.description && <p className="text-sm text-neutral-600 dark:text-neutral-400">{asset.description}</p>}
              {asset.tags && asset.tags.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" />标签</p>
                  <div className="flex flex-wrap gap-1.5">{asset.tags.map((t) => <Badge key={t} color={stringToColor(t)}>{t}</Badge>)}</div>
                </div>
              )}
              {asset.prompt && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Prompt</p>
                  <div className="relative group">
                    <div className="text-sm bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
                      <HighlightedPrompt
                        text={asset.prompt}
                        annotations={((asset.parameters as any)?.annotations as PromptAnnotation[]) || []}
                      />
                    </div>
                    <button onClick={() => copyToClipboard(asset.prompt!)} className="absolute top-2 right-2 p-1.5 rounded bg-white dark:bg-neutral-800 shadow-sm border opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t flex-wrap">
                {/* 公开/私密切换 */}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const next = !asset.is_public;
                    await supabase.from("assets").update({ is_public: next }).eq("id", asset.id);
                    setAsset({ ...asset, is_public: next });
                    toast.success(next ? "已公开，所有人都可以在「发现」页看到" : "已设为私密");
                  }}
                >
                  {asset.is_public ? "🌍 公开" : "🔒 私密"}
                </Button>
                {asset.url && (
                  <>
                    <a href={asset.url} download target="_blank" rel="noopener"><Button size="sm" variant="secondary"><Download className="w-4 h-4" />下载</Button></a>
                    <Button size="sm" variant="secondary" onClick={() => copyToClipboard(asset.url!)}><Copy className="w-4 h-4" />复制链接</Button>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
      {asset && <CommentSection assetId={asset.id} isAdmin={isAdmin} />}
      <ShareModal assetId={asset.id} assetTitle={asset.title} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <Icon className="w-4 h-4 mx-auto text-neutral-400 mb-1" />
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </Card>
  );
}
