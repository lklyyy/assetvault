@echo off
chcp 65001 >nul
title AssetVault 快速安装
cd /d "%~dp0"

echo.
echo   ╔══════════════════════════════════════╗
echo   ║   AssetVault AI 素材库 · 安装向导  ║
echo   ╚══════════════════════════════════════╝
echo.

:: 1. 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 未检测到 Node.js
    echo     正在打开下载页面...
    start https://nodejs.org/
    echo     安装 Node.js LTS 版本后，重新运行本脚本
    pause
    exit /b 1
)
echo [√] Node.js: %node_version%

:: 2. 检查 git / 下载代码
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Git 未安装，使用直接下载...
    curl -k -L -o assetvault.zip https://github.com/lklyyy/assetvault/archive/refs/heads/master.zip
    tar -xf assetvault.zip
    cd assetvault-master
) else (
    echo [√] Git 已安装
    if exist "assetvault" (
        echo [√] 已有代码，更新中...
        cd assetvault
        git pull
    ) else (
        echo [↓] 下载代码...
        git clone https://github.com/lklyyy/assetvault.git
        cd assetvault
    )
)

:: 3. 安装依赖
echo [1/2] 安装依赖（首次约2分钟）...
call npm install

:: 4. 构建
echo [2/2] 编译...
call npm run build

:: 5. 完成
echo.
echo   ╔══════════════════════════════════════╗
echo   ║  ✓ 安装完成！                      ║
echo   ║                                    ║
echo   ║  启动方式:                          ║
echo   ║  1. 双击 start-desktop.bat  (桌面)  ║
echo   ║  2. 浏览器打开 localhost:3000       ║
echo   ╚══════════════════════════════════════╝
echo.
start http://localhost:3000
call npm run start
pause
