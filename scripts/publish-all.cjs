// 将用户的所有资产设为公开
const { createClient } = require("@supabase/supabase-js");

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; const supabase = createClient(
  "https://eujvciflkpoyftbyxokp.supabase.co",
  KEY
);

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log("用法: node scripts/publish-all.cjs <邮箱>");
    process.exit(1);
  }

  // 查用户
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error("查找用户失败:", listErr.message); process.exit(1); }

  const user = listData.users.find(u => u.email === email);
  if (!user) { console.error("未找到用户:", email); process.exit(1); }

  console.log("用户:", user.email, user.id);

  // 将所有资产设为公开
  const { data: assets, error: fetchErr } = await supabase
    .from("assets")
    .select("id, title")
    .eq("owner_id", user.id)
    .eq("is_public", false);

  if (fetchErr) { console.error("查询失败:", fetchErr.message); process.exit(1); }

  if (!assets || assets.length === 0) {
    console.log("所有资产已经是公开状态");
    process.exit(0);
  }

  console.log(`找到 ${assets.length} 个未公开资产，正在公开...`);

  const { error: updateErr } = await supabase
    .from("assets")
    .update({ is_public: true })
    .eq("owner_id", user.id)
    .eq("is_public", false);

  if (updateErr) {
    console.error("更新失败:", updateErr.message);
  } else {
    console.log(`✓ 已将 ${assets.length} 个资产设为公开`);
  }
}

main();
