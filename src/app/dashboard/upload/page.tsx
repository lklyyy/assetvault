"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Textarea, Card, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  UploadCloud, X, Plus, Tag, FolderOpen, Clipboard, Loader2,
} from "lucide-react";
import type { Collection } from "@/types";
import { PromptAnnotationEditor, type PromptAnnotation } from "@/components/assets/prompt-annotation";

const MODEL_PRESETS = [
  "Midjourney", "DALL·E 3", "Stable Diffusion XL",
  "DALL·E 2", "Stable Diffusion 3", "Flux", "ComfyUI",
  "Firefly", "Imagen", "其他",
];

export default function UploadPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8 text-blue-500" /></div>}>
      <UploadPage />
    </Suspense>
  );
}

function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [pendingPaths, setPendingPaths] = useState<string[]>([]); // 预缓存文件路径
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [collections, setCollections] = useState<Collection[]>([]);

  // 元数据
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptAnnotations, setPromptAnnotations] = useState<PromptAnnotation[]>([]);
  const [model, setModel] = useState("");
  const [modelCustom, setModelCustom] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [isPublic, setIsPublic] = useState(true); // 默认公开

  // 自动补全标签（模拟常用标签）
  const suggestedTags = [
    "人物", "风景", "插画", "3D", "写实", "动漫", "抽象",
    "logo", "UI", "海报", "头像", "壁纸", "产品图",
  ];

  useEffect(() => {
    fetchCollections();
  }, []);

  // 监听剪贴板粘贴
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFiles(imageFiles);
        toast.success(`从剪贴板添加了 ${imageFiles.length} 张图片`);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // ---- 处理从布局拖拽传入的预缓存文件 ----
  useEffect(() => {
    const pending = searchParams.get("pending");
    if (!pending) return;

    const paths = decodeURIComponent(pending).split("|").filter(Boolean);
    if (paths.length === 0) return;

    const isElectron = typeof window !== "undefined" && !!window.electronCache;
    const avPaths: string[] = [];
    const newPreviews: string[] = [];

    const loadPending = async () => {
      for (const p of paths) {
        if (isElectron && p.startsWith("av-cache://")) {
          avPaths.push(p);
          newPreviews.push(p); // av-cache URL 可直接用于 <img>
        } else if (p.startsWith("session:")) {
          const key = p.replace("session:", "");
          const raw = sessionStorage.getItem(key);
          if (raw) {
            try {
              const { dataUrl, name, type, size } = JSON.parse(raw);
              const resp = await fetch(dataUrl);
              const blob = await resp.blob();
              const file = new File([blob], name, { type });
              setFiles(prev => [...prev, file]);
              newPreviews.push(dataUrl);
              sessionStorage.removeItem(key);
            } catch {}
          }
        }
      }
      if (avPaths.length > 0) setPendingPaths(prev => [...prev, ...avPaths]);
      if (newPreviews.length > 0) setPreviews(prev => [...prev, ...newPreviews]);
      // 尝试从文件名推断标题
      if (!title && newPreviews.length > 0) {
        const firstPath = paths[0];
        const namePart = firstPath.replace(/^.*[/\\]/, "").replace(/\.[^/.]+$/, "");
        setTitle(namePart || "从拖拽导入");
      }
    };
    loadPending();

    // 清理 URL 中的 pending 参数
    const params = new URLSearchParams(searchParams);
    params.delete("pending");
    router.replace(`/dashboard/upload?${params.toString()}`, { scroll: false });
  }, []);

  const fetchCollections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("collections")
      .select("*")
      .eq("owner_id", user.id)
      .order("sort_order");
    if (data) setCollections(data as Collection[]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    handleFiles(dropped);
  }, []);

  const handleFiles = (newFiles: File[]) => {
    const imageFiles = newFiles.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("仅支持图片文件");
      return;
    }
    setFiles((prev) => [...prev, ...imageFiles]);
    imageFiles.forEach((f) => {
      setPreviews((prev) => [...prev, URL.createObjectURL(f)]);
    });
    if (!title && imageFiles.length > 0) {
      setTitle(imageFiles[0].name.replace(/\.[^/.]+$/, ""));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(previews[index]);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const addTag = (t?: string) => {
    const tag = (t || tagInput).trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const getEffectiveModel = () => {
    if (model === "其他" && modelCustom) return modelCustom;
    return model;
  };

  const handleUpload = async () => {
    const totalItems = files.length + pendingPaths.length;
    if (totalItems === 0) { toast.error("请选择文件、拖入图片或从剪贴板粘贴 (Ctrl+V)"); return; }
    if (!title.trim()) { toast.error("请输入标题"); return; }

    setUploading(true);
    setUploadProgress({ current: 0, total: totalItems });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("请先登录"); setUploading(false); return; }

    const effectiveModel = getEffectiveModel();
    const isDesktop = typeof window !== "undefined" && !!window.electronCache;
    let success = 0;
    let current = 0;

    // ---- 处理标准 File 对象 ----
    for (const file of files) {
      const ext = file.name.split(".").pop() || "png";
      const basePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      let finalUrl: string = "";

      if (isDesktop) {
        // 桌面端：本地秒存（不上传云端，用户手动点同步）
        const buf = await file.arrayBuffer();
        const arr = Array.from(new Uint8Array(buf));
        const localUrl = await window.electronCache!.bufferToCache(arr, file.name);
        finalUrl = localUrl || "";
      } else {
        // 网页端：直接上传到 Supabase
        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", user.id);
        formData.append("path", basePath);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const { url: publicUrl } = await uploadRes.json();
          finalUrl = publicUrl;
        }
      }

      if (finalUrl) {
        let width: number | null = null, height: number | null = null;
        if (file.type.startsWith("image/")) {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await new Promise<void>((resolve) => {
            img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; resolve(); };
            img.onerror = () => resolve();
          });
        }

        const { error: insertError } = await supabase.from("assets").insert({
          owner_id: user.id, type: "image",
          title: title || file.name.replace(/\.[^/.]+$/, ""),
          description: description || null, prompt: prompt || null,
          model: effectiveModel || null, tags,
          collection_id: collectionId || null,
          storage_path: isDesktop ? null : basePath,
          url: finalUrl, file_size: file.size, mime_type: file.type, width, height,
          is_public: isPublic,
          parameters: promptAnnotations.length > 0 ? { annotations: promptAnnotations } : null,
        });
        if (!insertError) success++;
      }
      current++;
      setUploadProgress({ current, total: totalItems });
    }

    // ---- 处理预缓存路径 (av-cache://) ----
    for (const avPath of pendingPaths) {
      const fileName = avPath.replace(/^.*[/\\]/, "");
      const ext = fileName.split(".").pop() || "png";
      let finalUrl = avPath;
      let fileSize: number | null = null;
      let width: number | null = null, height: number | null = null;

      if (isDesktop) {
        const bufArr = await window.electronCache!.readFileBuffer(avPath);
        if (bufArr) {
          fileSize = bufArr.length;
          const blob = new Blob([new Uint8Array(bufArr)]);
          const objUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.src = objUrl;
          await new Promise<void>((resolve) => {
            img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; resolve(); };
            img.onerror = () => resolve();
          });
          URL.revokeObjectURL(objUrl);
        }
      }

      if (!isDesktop) continue;

      const { error: insertError } = await supabase.from("assets").insert({
        owner_id: user.id, type: "image",
        title: title || fileName.replace(/\.[^/.]+$/, ""),
        description: description || null, prompt: prompt || null,
        model: effectiveModel || null, tags,
        collection_id: collectionId || null,
        storage_path: null,
        url: finalUrl, file_size: fileSize, mime_type: `image/${ext === "jpg" ? "jpeg" : ext}`,
        width, height,
        parameters: promptAnnotations.length > 0 ? { annotations: promptAnnotations } : null,
      });
      if (!insertError) success++;

      current++;
      setUploadProgress({ current, total: totalItems });
    }

    setUploading(false);

    if (success > 0) {
      const msg = isDesktop
        ? `已保存 ${success} 张到本地 · 点「同步」上传云端`
        : `上传成功 ${success} 个资产`;
      toast.success(msg);
      if (files.length > 0) {
        setFiles([]);
        previews.forEach((p) => { if (p.startsWith("blob:")) URL.revokeObjectURL(p); });
        setPreviews([]);
      }
      setPendingPaths([]);
      if (!description && !prompt && !tags.length) {
        router.push("/dashboard");
      }
    } else {
      toast.error("上传失败，请重试");
    }
  };

  const clearAll = () => {
    previews.forEach(URL.revokeObjectURL);
    setFiles([]); setPreviews([]);
    setPendingPaths([]);
    setTitle(""); setDescription(""); setPrompt("");
    setModel(""); setModelCustom(""); setTags([]); setCollectionId("");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">上传资产</h1>
          <p className="text-neutral-500 text-sm mt-1">
            拖拽、点击或 <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-xs font-mono">Ctrl+V</kbd> 粘贴图片
          </p>
        </div>
        {files.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>清空全部</Button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-10 text-center hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
          className="hidden"
        />
        <UploadCloud className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
        <p className="text-lg font-medium">拖拽图片到此处，或点击选择</p>
        <p className="text-sm text-neutral-400 mt-1 flex items-center justify-center gap-2">
          <Clipboard className="w-3.5 h-3.5" />
          也支持 Ctrl+V 从剪贴板粘贴
        </p>
        <p className="text-xs text-neutral-400 mt-2">JPG · PNG · WebP · GIF · AVIF</p>
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">
            已选择 {previews.length} 个文件
            <span className="text-neutral-400 font-normal ml-2">
              （所有文件将应用下方相同的元数据）
            </span>
          </h3>
          <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto">
            {previews.map((url, i) => (
              <div key={i} className="relative group flex-shrink-0">
                <img
                  src={url}
                  alt={`预览 ${i + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >×</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Metadata */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          资产信息
          {uploading && (
            <span className="text-sm font-normal text-blue-600 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {uploadProgress.current}/{uploadProgress.total}
            </span>
          )}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="标题 *"
            placeholder="给资产起个名字"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {/* Collection selector */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
              集合
            </label>
            <div className="flex gap-2">
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="">不分类</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon || "📁"} {c.name}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => router.push("/dashboard/collections")}
                title="管理集合"
              >
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Model selector */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
              AI 模型
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">选择模型...</option>
              {MODEL_PRESETS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {model === "其他" && (
              <input
                type="text"
                placeholder="输入模型名称"
                value={modelCustom}
                onChange={(e) => setModelCustom(e.target.value)}
                className="w-full mt-2 rounded-lg border px-3 py-2 text-sm bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
            Prompt / 提示词
          </label>
          <PromptAnnotationEditor
            value={prompt}
            onChange={(v) => setPrompt(v)}
            annotations={promptAnnotations}
            onAnnotationsChange={setPromptAnnotations}
            placeholder="记录 AI 生成所用的 prompt，选中文字可进行标注高亮"
          />
        </div>
        <Textarea
          label="描述"
          placeholder="简短描述..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Public toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="sr-only" />
            <div className={`w-10 h-6 rounded-full transition-colors ${isPublic ? "bg-emerald-600" : "bg-neutral-300 dark:bg-neutral-700"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </div>
          </div>
          <div>
            <span className="text-sm font-medium">公开到发现页</span>
            <p className="text-xs text-neutral-400">其他用户可以在「发现」中看到并打分</p>
          </div>
        </label>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">标签</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="输入标签后按 Enter 添加"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              className="flex-1 rounded-lg border px-3 py-2 text-sm bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => addTag()}>
              <Plus className="w-4 h-4" />添加
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-medium">
                  <Tag className="w-3 h-3" />
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          )}
          {/* Suggested tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestedTags.filter((t) => !tags.includes(t)).slice(0, 8).map((t) => (
              <button
                key={t}
                onClick={() => addTag(t)}
                className="px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Upload button */}
      <div className="flex gap-3 justify-end sticky bottom-0 py-4 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-t border-neutral-200 dark:border-neutral-800 -mx-6 px-6">
        <Button variant="secondary" onClick={() => router.back()}>取消</Button>
        <Button onClick={handleUpload} disabled={uploading} size="lg">
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />上传中 {uploadProgress.current}/{uploadProgress.total}</>
          ) : (
            `上传 ${files.length} 个文件${collectionId ? `到「${collections.find(c => c.id === collectionId)?.name || ""}」` : ""}`
          )}
        </Button>
      </div>
    </div>
  );
}
