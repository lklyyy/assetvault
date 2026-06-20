"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Comment {
  id: string;
  assetId: string;
  authorName: string;
  authorId: string;
  content: string;
  createdAt: string;
}

/** 从 localStorage 读取评论 */
function getComments(assetId: string): Comment[] {
  try {
    const raw = localStorage.getItem(`av_comments_${assetId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** 保存评论到 localStorage */
function saveComments(assetId: string, comments: Comment[]) {
  localStorage.setItem(`av_comments_${assetId}`, JSON.stringify(comments));
}

interface Props {
  assetId: string;
  isAdmin?: boolean;
}

export function CommentSection({ assetId, isAdmin = false }: Props) {
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setComments(getComments(assetId));
    loadUser();
  }, [assetId]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      setCurrentUser({
        id: user.id,
        name: profile?.display_name || user.email?.split("@")[0] || "用户",
      });
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !currentUser) return;
    setSubmitting(true);

    const comment: Comment = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      assetId,
      authorName: currentUser.name,
      authorId: currentUser.id,
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [comment, ...getComments(assetId)];
    saveComments(assetId, updated);
    setComments(updated);
    setNewComment("");
    toast.success("评论已发表");
    setSubmitting(false);
  };

  const handleDelete = (commentId: string) => {
    const filtered = comments.filter((c) => c.id !== commentId);
    saveComments(assetId, filtered);
    setComments(filtered);
    toast.success("已删除");
  };

  const canDelete = (comment: Comment) => {
    return isAdmin || (currentUser && comment.authorId === currentUser.id);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <MessageCircle className="w-4 h-4" />
        留言 ({comments.length})
      </h3>

      {/* New comment input */}
      {currentUser && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="写下你的想法..."
            className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">还没有留言，来发表第一条吧</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0">
                {c.authorName[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.authorName}</span>
                  <span className="text-[10px] text-neutral-400">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm mt-0.5 text-neutral-700 dark:text-neutral-300">{c.content}</p>
              </div>
              {canDelete(c) && (
                <button onClick={() => handleDelete(c.id)} className="text-neutral-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
