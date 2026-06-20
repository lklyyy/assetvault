"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types";

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data as Profile);
      setDisplayName(data.display_name || "");
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", profile.id);

    if (error) toast.error("保存失败");
    else toast.success("已保存");
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-neutral-500 text-sm mt-1">账户和个人偏好</p>
      </div>

      {/* Profile */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">个人资料</h3>
        <Input
          label="邮箱"
          value={profile?.email || ""}
          disabled
        />
        <Input
          label="显示名称"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="你的显示名称"
        />
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </Card>

      {/* Info */}
      <Card className="p-6 space-y-2 text-sm text-neutral-500">
        <h3 className="font-semibold text-neutral-700 dark:text-neutral-300">关于 AssetVault</h3>
        <p>AI 生成内容资产管理工具 — 图片 · 提示词 · 模型参数</p>
        <p>数据存储：<a href="https://supabase.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Supabase</a>（你的独立数据库）</p>
        <p className="text-xs text-neutral-400 mt-2">桌面版 · 缓存加速 · 离线浏览</p>
      </Card>
    </div>
  );
}
