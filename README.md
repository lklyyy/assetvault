# AssetVault — AI 资产管理库

管理你的 AI 生成图片、文字和提示词，分类整理，团队共享。

## 技术栈

- **Next.js 16** — React 全栈框架 (App Router)
- **Supabase** — 认证 + PostgreSQL 数据库 + S3 兼容存储
- **Tailwind CSS 4** — 样式
- **TypeScript** — 类型安全

## 快速开始

### 1. 创建 Supabase 项目

1. 前往 [supabase.com](https://supabase.com) 注册/登录
2. 创建一个新项目（选择离你最近的区域）
3. 在 **SQL Editor** 中运行 `supabase-schema.sql` 文件内容
4. 在 **Storage** 中创建名为 `assets` 的公开存储桶
5. 复制 Storage 策略 SQL（schema 文件末尾注释部分）并在 SQL Editor 中运行
6. 在 **Settings > API** 中获取 `anon public key` 和 `URL`

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入 Supabase 项目信息：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # 可选，服务端用
```

### 3. 运行

```bash
npm install
npm run dev
```

打开 http://localhost:3000

### 4. 部署到 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 或直接通过 GitHub 导入到 vercel.com
```

在 Vercel 项目设置中添加相同的环境变量。

## 功能

- 🖼️ **图片上传** — 拖拽上传，自动预览
- 🏷️ **标签系统** — 灵活分类，按标签筛选
- 📝 **元数据管理** — 记录 prompt、AI 模型、生成参数
- 📁 **集合** — 文件夹式分类管理
- 🔍 **全文搜索** — 搜索标题、prompt、描述
- 👥 **团队共享** — 按邮箱共享，view/edit 权限控制
- 🌓 **深色模式** — 自动跟随系统

## 项目结构

```
src/
├── app/
│   ├── (auth)/           # 登录/注册
│   ├── (dashboard)/      # 管理面板
│   │   ├── upload/       # 上传页
│   │   ├── assets/[id]/  # 资产详情
│   │   ├── collections/  # 集合管理
│   │   └── settings/     # 设置
│   └── api/              # API 路由
├── components/
│   ├── ui/               # 通用 UI 组件
│   ├── layout/           # 布局组件
│   └── assets/           # 资产相关组件
├── lib/
│   └── supabase/         # Supabase 客户端
└── types/                # TypeScript 类型
```

## 成本

- **免费层**：500MB 数据库 + 1GB 存储，适合 2-5 人团队
- **Supabase Pro**：$25/月（8GB DB + 100GB 存储）
- **Vercel**：免费层足够个人/小团队使用
