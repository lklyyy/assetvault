"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize } from "lucide-react";
import { CachedImage } from "./cached-image";

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ZoomableImage({ src, alt, className = "" }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampScale = (s: number) => Math.max(0.1, Math.min(s, 10));

  // 获取原图尺寸
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Ctrl+滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => clampScale(prev * delta));
  }, []);

  // 拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  // 双击：100% ↔ 适应
  const handleDoubleClick = () => {
    if (scale > 1.01) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
      setPosition({ x: 0, y: 0 });
    }
  };

  // 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "=") {
        e.preventDefault();
        setScale((prev) => clampScale(prev * 1.2));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        setScale((prev) => clampScale(prev / 1.2));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="space-y-2">
      {/* 缩放控件 */}
      <div className="flex items-center gap-1 justify-center">
        <button onClick={() => setScale((p) => clampScale(p / 1.2))}
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="缩小 (Ctrl+-)">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-neutral-500 w-12 text-center tabular-nums font-mono">{zoomPercent}%</span>
        <button onClick={() => setScale((p) => clampScale(p * 1.2))}
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="放大 (Ctrl+=)">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="适应窗口 (Ctrl+0)">
          <Minimize className="w-4 h-4" />
        </button>
        <button onClick={() => { setScale(2); setPosition({ x: 0, y: 0 }); }}
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="双击放大">
          <Maximize className="w-4 h-4" />
        </button>
        {imgNatural && (
          <span className="text-xs text-neutral-400 ml-2 hidden sm:inline">
            原图 {imgNatural.w}×{imgNatural.h}
          </span>
        )}
      </div>

      {/* 图片容器 — 自适应高度，大图可滚 */}
      <div
        ref={containerRef}
        className="relative overflow-auto rounded-xl border bg-neutral-50 dark:bg-neutral-950 cursor-grab active:cursor-grabbing"
        style={{
          maxHeight: scale <= 1 ? "82vh" : "90vh",
          minHeight: "300px",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            minWidth: scale > 1 ? `${scale * 100}%` : "100%",
            minHeight: scale > 1 ? `${scale * 100}%` : "100%",
          }}
        >
          <CachedImage
            src={src}
            alt={alt}
            draggable={false}
            onLoad={handleImgLoad}
            className="select-none block"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: dragging ? "none" : "transform 0.15s ease-out",
              maxWidth: scale <= 1 ? "100%" : "none",
              maxHeight: scale <= 1 ? "82vh" : "none",
              objectFit: "contain",
            }}
          />
        </div>
      </div>
    </div>
  );
}
