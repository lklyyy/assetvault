"use client";

import { useState, useEffect } from "react";
import { cachedImageUrl, preCacheImages } from "@/lib/cache";

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: string;
}

/** 自动使用本地缓存的图片组件 */
export function CachedImage({ src, fallback, className, alt, ...props }: CachedImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;
    // av-cache:// 或 file:// 直接可用，不需要缓存查找
    // file:// → av-cache:// 绕过 Electron http 页面安全限制
    if (src.startsWith("file://")) {
      setImgSrc(src.replace(/^file:\/\/\/?/, "av-cache:///"));
      return;
    }
    if (src.startsWith("av-cache://")) {
      setImgSrc(src);
      return;
    }
    let cancelled = false;
    cachedImageUrl(src).then((cached) => {
      if (!cancelled && cached) setImgSrc(cached);
    });
    return () => { cancelled = true; };
  }, [src]);

  return (
    <img
      src={error && fallback ? fallback : imgSrc}
      alt={alt || ""}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
      {...props}
    />
  );
}

/** 预缓存一组图片 */
export function usePreCache(urls: string[]) {
  useEffect(() => {
    if (urls.length === 0) return;
    preCacheImages(urls);
  }, [urls]);
}
