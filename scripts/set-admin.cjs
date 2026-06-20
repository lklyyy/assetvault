// 创建 is_admin 列并设置管理员
const { createClient } = require("@supabase/supabase-js");

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; const supabase = createClient(
  "https://eujvciflkpoyftbyxokp.supabase.co",
  KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const email = process.argv[2] || "2638221323@qq.com";

  // 1. 通过 PostgreSQL 函数创建列（如果有权限）
  // 直接尝试 upsert，supabase-js 不会做列校验，Postgres 会报错如果列不存在
  
  // 先获取用户
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error("获取用户列表失败:", listErr.message); process.exit(1); }

  const user = listData.users.find((u) => u.email === email);
  if (!user) {
    console.error("未找到用户", email);
    console.log("请确保该邮箱已在 AssetVault 注册并登录过");
    process.exit(1);
  }

  console.log("找到用户:", user.id, user.email);

  // 2. 尝试直接 upsert
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, display_name: user.email.split("@")[0], is_admin: true }, { onConflict: "id" });

  if (error) {
    console.error("设置失败:", error.message);
    console.log("\n需要手动运行 SQL（30秒）:");
    console.log("1. 打开 https://supabase.com/dashboard/project/eujvciflkpoyftbyxokp/sql/new");
    console.log("2. 粘贴以下内容 → Run:\n");
    console.log("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;");
    console.log(`UPDATE profiles SET is_admin = true WHERE email = '${email}';`);
    process.exit(1);
  }

  console.log("✓", email, "已设为管理员！");
  console.log("刷新页面后即可看到管理员权限（删除任意资产/评论）");
}

main();
