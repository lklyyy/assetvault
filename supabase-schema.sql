-- ============================================
-- AI 资产管理库 - 数据库 Schema
-- 在 Supabase SQL Editor 中运行此文件
-- ============================================

-- 1. 用户资料表（自动触发创建）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 自动创建 profile（注册时）
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. 集合表（分类文件夹）
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  icon TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_collections_owner ON collections(owner_id);
CREATE INDEX idx_collections_parent ON collections(parent_id);

-- 3. 资产表
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'text', 'file')) DEFAULT 'image',
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT,
  model TEXT,
  parameters JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  storage_path TEXT,
  url TEXT,
  thumbnail_url TEXT,
  text_content TEXT,
  file_size BIGINT,
  mime_type TEXT,
  width INT,
  height INT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  view_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_assets_owner ON assets(owner_id);
CREATE INDEX idx_assets_collection ON assets(collection_id);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_tags ON assets USING GIN(tags);
CREATE INDEX idx_assets_created ON assets(created_at DESC);

-- 全文搜索索引
CREATE INDEX idx_assets_search ON assets
  USING GIN (
    to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(prompt, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(text_content, ''))
  );

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. 资产共享表
CREATE TABLE IF NOT EXISTS asset_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')) DEFAULT 'view',
  UNIQUE(asset_id, shared_with)
);

-- 5. 集合共享表
CREATE TABLE IF NOT EXISTS collection_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')) DEFAULT 'view',
  UNIQUE(collection_id, shared_with)
);

-- ============ Row Level Security ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_shares ENABLE ROW LEVEL SECURITY;

-- Profiles: 所有人可读，本人可写
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Collections: 本人 CRUD，共享者可读
CREATE POLICY "Owner can manage collections" ON collections
  FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Shared users can view collections" ON collections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collection_shares
      WHERE collection_id = collections.id AND shared_with = auth.uid()
    )
  );

-- Assets: 本人 CRUD + 共享者权限
CREATE POLICY "Owner can manage assets" ON assets
  FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Shared users can view assets" ON assets
  FOR SELECT USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM asset_shares
      WHERE asset_id = assets.id AND shared_with = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM collection_shares cs
      WHERE cs.collection_id = assets.collection_id AND cs.shared_with = auth.uid()
    )
  );
CREATE POLICY "Shared users can update assets" ON assets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM asset_shares
      WHERE asset_id = assets.id AND shared_with = auth.uid() AND permission = 'edit'
    )
  );

-- Shares: 所有者可管理
CREATE POLICY "Owner can manage asset shares" ON asset_shares
  FOR ALL USING (auth.uid() = shared_by);
CREATE POLICY "Owner can manage collection shares" ON collection_shares
  FOR ALL USING (auth.uid() = shared_by);

-- ============ Storage 存储桶 ============
-- 需要手动在 Supabase Storage 中创建名为 "assets" 的公开桶
-- 然后设置以下策略：

/*
-- Storage: 任何人可读（公开桶）
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets');

-- Storage: 登录用户可上传
CREATE POLICY "Auth users can upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');

-- Storage: 本人可删除自己的文件
CREATE POLICY "Owner can delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'assets' AND auth.uid()::text = owner);
*/
