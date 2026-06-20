"use client";

import { Sidebar, DashboardHeader } from "@/components/layout";
import { Toaster } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    const params = new URLSearchParams(window.location.search);
    if (q) params.set("search", q);
    else params.delete("search");
    router.replace(`/dashboard?${params.toString()}`);
  };

  // ---- 原生拖拽导入 ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只在离开根元素时取消高亮
    if (e.currentTarget === e.target) setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) { toast.warning("请拖入图片文件"); return; }

    const pendingPaths: string[] = [];
    const isElectron = typeof window !== "undefined" && !!window.electronCache;

    for (const file of imageFiles) {
      if (isElectron) {
        // Electron: 使用文件路径直接复制到缓存
        const electronFile = file as File & { path?: string };
        if (electronFile.path) {
          const cached = await window.electronCache!.copyToCache(electronFile.path);
          if (cached) pendingPaths.push(cached);
        } else {
          // 如果是浏览器拖入（无 path），用 buffer
          const buf = await file.arrayBuffer();
          const cached = await window.electronCache!.bufferToCache(
            Array.from(new Uint8Array(buf)), file.name
          );
          if (cached) pendingPaths.push(cached);
        }
      } else {
        // 纯浏览器：转 base64 dataURL 暂存到 sessionStorage
        const buf = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buf));
        const b64 = btoa(bytes.reduce((s, b) => s + String.fromCharCode(b), ""));
        const dataUrl = `data:${file.type};base64,${b64}`;
        const key = `av_drop_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(key, JSON.stringify({ dataUrl, name: file.name, type: file.type, size: file.size }));
        pendingPaths.push(`session:${key}`);
      }
    }

    if (pendingPaths.length > 0) {
      const joined = encodeURIComponent(pendingPaths.join("|"));
      router.push(`/dashboard/upload?pending=${joined}`);
      toast.success(`已接收 ${pendingPaths.length} 个文件`);
    }
  }, [router]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽高亮遮罩 */}
      {dragOver && (
        <div className="fixed inset-0 z-[60] bg-blue-500/10 border-4 border-dashed border-blue-500 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl px-8 py-6 text-center">
            <div className="text-4xl mb-2">📥</div>
            <p className="text-lg font-semibold">释放文件以导入</p>
            <p className="text-sm text-neutral-500 mt-1">图片将自动加入资产管理库</p>
          </div>
        </div>
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader searchQuery={searchQuery} onSearchChange={handleSearch} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
