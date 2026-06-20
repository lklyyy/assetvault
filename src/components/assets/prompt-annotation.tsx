"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Highlighter, Tag } from "lucide-react";

export interface PromptAnnotation {
  start: number;
  end: number;
  label: string;
  color: string;
}

const ANNOTATION_LABELS: { label: string; color: string; description: string }[] = [
  { label: "主题", color: "#7c3aed", description: "Subject — 画面主体" },
  { label: "风格", color: "#2563eb", description: "Style — 艺术风格" },
  { label: "光影", color: "#d97706", description: "Lighting — 光照氛围" },
  { label: "构图", color: "#059669", description: "Composition — 构图方式" },
  { label: "画质", color: "#ea580c", description: "Quality — 画质修饰" },
  { label: "负面", color: "#dc2626", description: "Negative — 负面提示词" },
];

interface Props {
  value: string;
  onChange: (text: string) => void;
  annotations: PromptAnnotation[];
  onAnnotationsChange: (anns: PromptAnnotation[]) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
}

export function PromptAnnotationEditor({
  value,
  onChange,
  annotations,
  onAnnotationsChange,
  placeholder = "输入 Prompt...",
  rows = 6,
  readOnly = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);

  // Handle text selection
  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      setShowToolbar(false);
      setSelection(null);
      return;
    }
    const text = ta.value.substring(start, end).trim();
    if (!text) { setShowToolbar(false); return; }
    setSelection({ start, end, text });

    // Position toolbar near selection
    const rect = ta.getBoundingClientRect();
    // Approximate position based on selection
    const lineHeight = 20;
    const textBefore = ta.value.substring(0, start);
    const lines = textBefore.split("\n").length - 1;
    const lastLineStart = textBefore.lastIndexOf("\n") + 1;
    const charsInLine = start - lastLineStart;
    const left = rect.left + Math.min(charsInLine * 8, rect.width - 200) + ta.scrollLeft;
    const top = rect.top + lines * lineHeight - 40 + ta.scrollTop;
    setToolbarPos({ top: Math.max(0, top), left: Math.max(0, left) });
    setShowToolbar(true);
  }, []);

  // Apply annotation
  const applyAnnotation = (label: string, color: string) => {
    if (!selection) return;
    // Don't allow overlapping annotations
    const overlaps = annotations.some(
      (a) => selection.start < a.end && selection.end > a.start
    );
    if (overlaps) {
      // Simple: remove existing overlapping and add new
      const filtered = annotations.filter(
        (a) => !(selection.start < a.end && selection.end > a.start)
      );
      onAnnotationsChange([...filtered, { start: selection.start, end: selection.end, label, color }]);
    } else {
      onAnnotationsChange([...annotations, { start: selection.start, end: selection.end, label, color }]);
    }
    setShowToolbar(false);
    setSelection(null);
    textareaRef.current?.focus();
  };

  // Remove annotation
  const removeAnnotation = (index: number) => {
    onAnnotationsChange(annotations.filter((_, i) => i !== index));
  };

  // Close toolbar on outside click
  useEffect(() => {
    if (!showToolbar) return;
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowToolbar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showToolbar]);

  // Render highlighted prompt (for display mode)
  const renderHighlighted = () => {
    if (annotations.length === 0) {
      return <span className="whitespace-pre-wrap">{value}</span>;
    }
    const sorted = [...annotations].sort((a, b) => a.start - b.start);
    const parts: React.ReactNode[] = [];
    let cursor = 0;

    for (const ann of sorted) {
      if (ann.start > cursor) {
        parts.push(<span key={`txt-${cursor}`} className="whitespace-pre-wrap">{value.slice(cursor, ann.start)}</span>);
      }
      parts.push(
        <span
          key={`ann-${ann.start}-${ann.end}`}
          style={{
            backgroundColor: ann.color + "22",
            borderBottom: `2px solid ${ann.color}`,
            borderRadius: "2px",
          }}
          title={`${ann.label}: ${value.slice(ann.start, ann.end)}`}
          className="px-0.5 cursor-help"
        >
          {value.slice(ann.start, ann.end)}
        </span>
      );
      cursor = ann.end;
    }
    if (cursor < value.length) {
      parts.push(<span key={`txt-${cursor}`} className="whitespace-pre-wrap">{value.slice(cursor)}</span>);
    }
    return <>{parts}</>;
  };

  return (
    <div className="space-y-2">
      {/* Show highlighted prompt above textarea (if annotations exist) */}
      {annotations.length > 0 && !readOnly && (
        <div className="text-sm leading-relaxed p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 max-h-32 overflow-y-auto">
          {renderHighlighted()}
        </div>
      )}

      {/* Annotation legend */}
      {annotations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {annotations.map((ann, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: ann.color + "22", color: ann.color, border: `1px solid ${ann.color}44` }}
            >
              <Highlighter className="w-2.5 h-2.5" />
              {ann.label}: {value.slice(ann.start, ann.end).slice(0, 15)}{value.slice(ann.start, ann.end).length > 15 ? "…" : ""}
              {!readOnly && (
                <button onClick={() => removeAnnotation(i)} className="hover:opacity-70 ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      {readOnly ? (
        <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 max-h-48 overflow-y-auto">
          {renderHighlighted()}
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onMouseUp={handleSelect}
            onKeyUp={(e) => {
              // Handle selection via keyboard (Shift+Arrow)
              if (e.shiftKey) handleSelect();
            }}
            placeholder={placeholder}
            rows={rows}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-y placeholder:text-neutral-400"
          />

          {/* Floating annotation toolbar */}
          {showToolbar && toolbarPos && selection && (
            <div
              ref={toolbarRef}
              className="fixed z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl p-2"
              style={{ top: toolbarPos.top, left: toolbarPos.left }}
            >
              <div className="text-[10px] text-neutral-400 px-2 pb-1.5 border-b border-neutral-100 dark:border-neutral-700 mb-1.5">
                标注「{selection.text.slice(0, 20)}{selection.text.length > 20 ? "…" : ""}」
              </div>
              <div className="flex flex-wrap gap-1">
                {ANNOTATION_LABELS.map(({ label, color, description }) => (
                  <button
                    key={label}
                    onClick={() => applyAnnotation(label, color)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                    style={{ backgroundColor: color + "18", color: color, border: `1px solid ${color}33` }}
                    title={description}
                  >
                    <Tag className="w-3 h-3 inline mr-1" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pure display component for highlighted prompt (used in read-only contexts) */
export function HighlightedPrompt({ text, annotations }: { text: string; annotations: PromptAnnotation[] }) {
  if (!annotations || annotations.length === 0) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  const sorted = [...annotations].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const ann of sorted) {
    if (ann.start > cursor) {
      parts.push(<span key={`txt-${cursor}`} className="whitespace-pre-wrap">{text.slice(cursor, ann.start)}</span>);
    }
    parts.push(
      <span
        key={`ann-${ann.start}-${ann.end}`}
        style={{
          backgroundColor: ann.color + "22",
          borderBottom: `2px solid ${ann.color}`,
          borderRadius: "2px",
        }}
        title={`${ann.label}: ${text.slice(ann.start, ann.end)}`}
        className="px-0.5 cursor-help"
      >
        {text.slice(ann.start, ann.end)}
      </span>
    );
    cursor = ann.end;
  }
  if (cursor < text.length) {
    parts.push(<span key={`txt-${cursor}`} className="whitespace-pre-wrap">{text.slice(cursor)}</span>);
  }
  return <>{parts}</>;
}
