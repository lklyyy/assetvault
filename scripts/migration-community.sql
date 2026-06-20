-- ============================================
-- AssetVault — 社区功能数据库迁移
-- 在 Supabase SQL Editor 中运行
-- ============================================

-- 1. profiles 表增加 is_admin 字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. 评论表
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE INDEX idx_comments_asset ON comments(asset_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- 3. RLS: comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 所有人可读评论
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (true);

-- 登录用户可发表评论
CREATE POLICY "Auth users can insert comments" ON comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);

-- 本人或管理员可删除评论
CREATE POLICY "Author or admin can delete comments" ON comments
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 4. RLS: profiles — 管理员可读取所有 profiles 用于显示名称
-- (已有策略允许所有人读 profiles，无需修改)

-- 5. RLS: assets — 管理员可删除任意资产
CREATE POLICY "Admin can delete any asset" ON assets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. RLS: assets — 管理员可更新任意资产
CREATE POLICY "Admin can update any asset" ON assets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 7. RLS: comments — 资产所有者可删除其资产下的评论
CREATE POLICY "Asset owner can delete comments on their assets" ON comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM assets WHERE id = comments.asset_id AND owner_id = auth.uid()
    )
  );
