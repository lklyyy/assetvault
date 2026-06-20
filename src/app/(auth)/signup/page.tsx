"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { Image } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(
        error.message === "User already registered"
          ? "该邮箱已注册"
          : error.message.includes("password")
          ? "密码至少需要 6 位"
          : `注册失败：${error.message}`
      );
      setLoading(false);
    } else {
      // 如果配置了邮箱验证，提示检查邮箱；否则直接跳转
      router.push("/login?signup=success");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-neutral-50 dark:bg-neutral-950">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Image className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">注册 AssetVault</h1>
          <p className="text-sm text-neutral-500 mt-1">创建你的 AI 资产管理库</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="显示名称"
            placeholder="你的名字"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="邮箱"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="密码"
            type="password"
            placeholder="至少 6 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "注册中..." : "注册"}
          </Button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-6">
          已有账号？{" "}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            登录
          </Link>
        </p>
      </Card>
    </div>
  );
}
