"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { FolderOpen, Plus, Trash2, MoreHorizontal } from "lucide-react";
import type { Collection } from "@/types";
import Link from "next/link";

export default function CollectionsPage() {
  const supabase = createClient();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchCollections(); }, []);

  const fetchCollections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("owner_id", user.id)
      .order("sort_order");

    if (!error && data) setCollections(data as Collection[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("collections").insert({
      owner_id: user.id,
      name: newName.trim(),
    });

    if (error) {
      toast.error("创建失败");
    } else {
      setNewName("");
      toast.success("已创建集合");
      fetchCollections();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("删除集合不会删除其中的资产。确定？")) return;
    await supabase.from("collections").delete().eq("id", id);
    toast.success("已删除");
    fetchCollections();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">集合</h1>
        <p className="text-neutral-500 text-sm mt-1">用集合来分类管理资产</p>
      </div>

      {/* Create */}
      <Card className="p-4 flex gap-3 items-end">
        <div className="flex-1">
          <Input
            label="新建集合"
            placeholder="集合名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
        </div>
        <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
          <Plus className="w-4 h-4" />
          创建
        </Button>
      </Card>

      {/* List */}
      {collections.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-500">还没有集合</p>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((col) => (
            <Card key={col.id} className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-xl">
                {col.icon || "📁"}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{col.name}</h3>
                {col.description && (
                  <p className="text-sm text-neutral-500">{col.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(col.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
