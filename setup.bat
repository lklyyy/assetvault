@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════╗
echo ║   AssetVault — 一键初始化脚本           ║
echo ╚══════════════════════════════════════════╝
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [✗] 未检测到 Node.js，正在安装...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --scope user
    echo [✓] Node.js 安装完成 — 请重新打开终端后再次运行此脚本
    pause
    exit /b
)
echo [✓] Node.js 已就绪

:: 2. Check npm packages
if not exist "node_modules" (
    echo [→] 安装依赖中...
    call npm install
    echo [✓] 依赖安装完成
) else (
    echo [✓] npm 依赖已存在
)

:: 3. Check env file
if not exist ".env.local" (
    echo.
    echo ┌─────────────────────────────────────────┐
    echo │  需要配置 Supabase 环境变量              │
    echo │                                         │
    echo │  1. 打开 https://supabase.com 创建项目  │
    echo │  2. 进入 Settings ^> API 获取：            │
    echo │     - Project URL                        │
    echo │     - anon public key                    │
    echo └─────────────────────────────────────────┘
    echo.
    set /p SUPABASE_URL="请输入 NEXT_PUBLIC_SUPABASE_URL: "
    set /p SUPABASE_ANON_KEY="请输入 NEXT_PUBLIC_SUPABASE_ANON_KEY: "
    
    (
        echo NEXT_PUBLIC_SUPABASE_URL=!SUPABASE_URL!
        echo NEXT_PUBLIC_SUPABASE_ANON_KEY=!SUPABASE_ANON_KEY!
        echo SUPABASE_SERVICE_ROLE_KEY=
    ) > .env.local
    echo [✓] .env.local 已创建
) else (
    echo [✓] .env.local 已存在
)

:: 4. Initialize Supabase database
echo.
echo [→] 正在初始化数据库...
echo ┌─────────────────────────────────────────┐
echo │  请在 Supabase SQL Editor 中运行        │
echo │  supabase-schema.sql 文件               │
echo │  (或者用 Supabase CLI: npx supabase ... │
echo └─────────────────────────────────────────┘
echo.

:: 5. Start dev server
echo [→] 启动开发服务器...
echo.
echo ┌─────────────────────────────────────────┐
echo │  打开 http://localhost:3000              │
echo │  按 Ctrl+C 停止                          │
echo └─────────────────────────────────────────┘
echo.
call npm run dev
