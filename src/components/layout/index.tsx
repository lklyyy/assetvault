"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Upload, Image, FolderOpen, Settings,
  LogOut, Menu, X, ChevronRight, ChevronLeft, Sparkles,
  PanelLeftClose, PanelLeft, Search, Star, Globe, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "画廊", icon: LayoutDashboard },
  { href: "/dashboard/explore", label: "发现", icon: Globe },
  { href: "/dashboard/board", label: "留言板", icon: MessageSquare },
  { href: "/dashboard/prompts", label: "提示词", icon: Sparkles },
  { href: "/dashboard/upload", label: "上传", icon: Upload },
  { href: "/dashboard/collections", label: "集合", icon: FolderOpen },
  { href: "/dashboard/settings", label: "设置", icon: Settings },
  { href: "/dashboard?favorite=1", label: "收藏", icon: Star },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // 从 localStorage 恢复折叠状态
  useEffect(() => {
    const saved = localStorage.getItem("av_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("av_sidebar_collapsed", String(next));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-neutral-900 border shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col transition-all duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center border-b border-neutral-200 dark:border-neutral-800", collapsed ? "justify-center px-2 py-4" : "gap-2 px-6 py-5")}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Image className="w-5 h-5 text-white" />
          </div>
          {!collapsed && <span className="font-semibold text-lg truncate">资产管理</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  active
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-2">
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex items-center justify-center w-full p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
              collapsed && "justify-center"
            )}
            title={collapsed ? "退出登录" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>退出登录</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export function DashboardHeader({
  searchQuery,
  onSearchChange,
}: {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center gap-4">
      <div className="flex-1" />
      <ThemeToggle />
      {onSearchChange && (
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <input
            type="text"
            placeholder="搜索 Prompt、标题、描述、标签…"
            value={searchQuery || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-neutral-400"
          />
        </div>
      )}
    </header>
  );
}
