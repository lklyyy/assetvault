// ========== 资产类型 ==========
export type AssetType = "image" | "text" | "file";

// ========== 资产 ==========
export interface Asset {
  id: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  type: AssetType;
  title: string;
  description: string | null;
  prompt: string | null; // AI 生成时的 prompt
  model: string | null; // 使用的 AI 模型
  parameters: Record<string, unknown> | null; // AI 生成参数 (JSON)
  tags: string[]; // 标签数组
  collection_id: string | null; // 所属集合
  storage_path: string | null; // Supabase Storage 路径
  url: string | null; // 公开 URL（图片/文件）
  thumbnail_url: string | null; // 缩略图 URL
  text_content: string | null; // 文字资产的内容（Markdown）
  file_size: number | null; // 文件大小（bytes）
  mime_type: string | null;
  width: number | null; // 图片宽度
  height: number | null; // 图片高度
  is_public: boolean;
  view_count: number;
}

// ========== 集合 / 分类 ==========
export interface Collection {
  id: string;
  created_at: string;
  owner_id: string;
  name: string;
  description: string | null;
  parent_id: string | null; // 支持嵌套
  icon: string | null;
  color: string | null;
  sort_order: number;
}

// ========== 用户资料 ==========
export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

// ========== 共享记录 ==========
export interface Share {
  id: string;
  created_at: string;
  asset_id: string;
  shared_by: string;
  shared_with: string; // user id 或 email
  permission: "view" | "edit";
}

export interface CollectionShare {
  id: string;
  created_at: string;
  collection_id: string;
  shared_by: string;
  shared_with: string;
  permission: "view" | "edit";
}

// ========== API 响应 ==========
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}
