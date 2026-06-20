"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Share2, X } from "lucide-react";

interface ShareModalProps {
  assetId: string;
  assetTitle: string;
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ assetId, assetTitle, open, onClose }: ShareModalProps) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!email.trim()) return;
    setSharing(true);

    // 查找用户
    const { data: profiles, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim())
      .single();

    if (lookupError || !profiles) {
      toast.error("未找到该用户（请确认对方已注册）");
      setSharing(false);
      return;
    }

    // 创建共享记录
    const { error } = await supabase.from("asset_shares").upsert(
      {
        asset_id: assetId,
        shared_with: profiles.id,
        permission,
      },
      { onConflict: "asset_id,shared_with" }
    );

    if (error) {
      toast.error("分享失败: " + error.message);
    } else {
      toast.success(`已共享「${assetTitle}」给 ${email}`);
      setEmail("");
      onClose();
    }
    setSharing(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={`共享「${assetTitle}」`}>
      <div className="space-y-4">
        <Input
          label="对方邮箱"
          type="email"
          placeholder="colleague@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
            权限
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setPermission("view")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                permission === "view"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700"
                  : "border-neutral-200 dark:border-neutral-700"
              }`}
            >
              👁️ 查看
            </button>
            <button
              onClick={() => setPermission("edit")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                permission === "edit"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700"
                  : "border-neutral-200 dark:border-neutral-700"
              }`}
            >
              ✏️ 编辑
            </button>
          </div>
        </div>
        <Button onClick={handleShare} disabled={sharing || !email.trim()} className="w-full">
          <Share2 className="w-4 h-4" />
          {sharing ? "共享中..." : "确认共享"}
        </Button>
      </div>
    </Modal>
  );
}
