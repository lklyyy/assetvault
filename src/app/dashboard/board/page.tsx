"use client";

import { useState, useEffect } from "react";
import { Card, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { MessageSquare, Send, Trash2, User } from "lucide-react";

interface BoardPost {
  id: string;
  authorName: string;
  authorId: string;
  content: string;
  createdAt: string;
}

const STORAGE_KEY = "av_board_posts";

function getPosts(): BoardPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePosts(posts: BoardPost[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

export default function BoardPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [newPost, setNewPost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setPosts(getPosts().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("display_name, is_admin").eq("id", user.id).single();
      setCurrentUser({
        id: user.id,
        name: profile?.display_name || user.email?.split("@")[0] || "用户",
      });
      if (profile?.is_admin) setIsAdmin(true);
    }
  };

  const handleSubmit = async () => {
    if (!newPost.trim() || !currentUser) return;
    setSubmitting(true);

    const post: BoardPost = {
      id: `bp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorName: currentUser.name,
      authorId: currentUser.id,
      content: newPost.trim(),
      createdAt: new Date().toISOString(),
    };

    const all = getPosts();
    savePosts([post, ...all]);
    setPosts([post, ...all]);
    setNewPost("");
    toast.success("已发布");
    setSubmitting(false);
  };

  const handleDelete = (postId: string) => {
    if (!confirm("确定删除这条留言？")) return;
    const filtered = getPosts().filter((p) => p.id !== postId);
    savePosts(filtered);
    setPosts(filtered);
    toast.success("已删除");
  };

  const canDelete = (post: BoardPost) => {
    return isAdmin || (currentUser && post.authorId === currentUser.id);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-500" />留言板
        </h1>
        <p className="text-neutral-500 text-sm mt-1">社区交流 · 分享心得 · 提问求助</p>
      </div>

      {/* New post */}
      {currentUser ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-700">
              {currentUser.name[0]?.toUpperCase()}
            </div>
            <span className="font-medium text-sm">{currentUser.name}</span>
          </div>
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="说点什么..."
            rows={3}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSubmit(); }
            }}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-400">Ctrl + Enter 发送</span>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !newPost.trim()}>
              <Send className="w-4 h-4" />发布
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center text-neutral-400">
          <User className="w-8 h-8 mx-auto mb-2" />
          <p>请先登录再留言</p>
        </Card>
      )}

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <MessageSquare className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium mb-1">还没有留言</h3>
          <p className="text-sm">成为第一个发言的人吧</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {post.authorName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{post.authorName}</span>
                    <span className="text-xs text-neutral-400">{formatDate(post.createdAt)}</span>
                  </div>
                  <p className="text-sm mt-2 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>
                {canDelete(post) && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="text-neutral-400 hover:text-red-500 flex-shrink-0 p-1"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
