"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { Image, CheckSquare, Square, Users } from "lucide-react";

const STORAGE_KEY = "av_remember";

const DEMO_ACCOUNTS = [
  { email: "demo1@assetvault.local", password: "demo123456", label: "演示账号 1" },
  { email: "demo2@assetvault.local", password: "demo123456", label: "演示账号 2" },
  { email: "demo3@assetvault.local", password: "demo123456", label: "演示账号 3" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);

  // 启动时检查：1) 已有有效会话 → 直接进；2) 有保存的账号 → 自动登录
  useEffect(() => {
    const checkSession = async () => {
      // 先检查是否已有有效会话
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
        return;
      }
      // 没有会话 → 尝试从 localStorage 恢复
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(atob(raw));
          if (saved.email && saved.password) {
            setEmail(saved.email);
            setPassword(saved.password);
            setRemember(true);
            if (saved.autoLogin) setAutoLogin(true);
          }
        }
      } catch {}
    };
    checkSession();
  }, []);

  // 自动登录
  useEffect(() => {
    if (!autoLogin || !email || !password) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        router.push("/dashboard");
      } else {
        setAutoLogin(false);
        setError("自动登录失败，请手动登录");
      }
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [autoLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "邮箱或密码错误"
          : error.message.includes("Email not confirmed")
          ? "邮箱未验证，请检查邮件"
          : `登录失败：${error.message}`
      );
      if (error.message === "Invalid login credentials") {
        localStorage.removeItem(STORAGE_KEY);
      }
      setLoading(false);
    } else {
      if (remember) {
        localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify({ email, password, autoLogin: true })));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
    if (error) {
      setError("演示账号登录失败，请联系管理员");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  if (autoLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Image className="w-7 h-7 text-white" />
          </div>
          <p className="text-neutral-500">自动登录中…</p>
          <button onClick={() => setAutoLogin(false)} className="text-xs text-blue-500 hover:underline mt-3 block">
            取消，手动登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-neutral-50 dark:bg-neutral-950">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Image className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">AssetVault</h1>
          <p className="text-sm text-neutral-500 mt-1">登录你的 AI 资产管理库</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input label="邮箱" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="密码" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button type="button" onClick={() => setRemember(!remember)} className="flex-shrink-0">
              {remember ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-neutral-400" />}
            </button>
            <span className="text-sm text-neutral-500">记住密码，下次自动登录</span>
          </label>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">{error}</div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>

        {/* 演示账号一键登录 */}
        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-400 text-center mb-2 flex items-center justify-center gap-1">
            <Users className="w-3 h-3" /> 快速体验 — 无需注册
          </p>
          <div className="flex gap-2">
            {DEMO_ACCOUNTS.map((acct) => (
              <button
                key={acct.email}
                onClick={() => handleDemoLogin(acct.email, acct.password)}
                disabled={loading}
                className="flex-1 text-xs py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                {acct.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">
          还没有账号？{" "}
          <Link href="/signup" className="text-blue-600 hover:underline font-medium">注册</Link>
        </p>
      </Card>
    </div>
  );
}
