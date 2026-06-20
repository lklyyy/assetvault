const { createClient } = require("@supabase/supabase-js");
const s = createClient(
  "https://eujvciflkpoyftbyxokp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1anZjaWZsa3BveWZ0Ynl4b2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDA0MDUsImV4cCI6MjA5NzI3NjQwNX0.SisL7Ou0dzqQuqyaRylLGFOBfjsXDQSDpJ-rj1pgNgc"
);

async function main() {
  // 1. 用 demo2 登录获取 token
  const { data: authData, error: authErr } = await s.auth.signInWithPassword({
    email: "demo2@assetvault.local",
    password: "demo123456"
  });
  if (authErr) { console.error("Login failed:", authErr.message); return; }
  console.log("Logged in as:", authData.user.email);

  // 2. 用 demo2 的身份查询公开资产
  const { data, error } = await s.from("assets").select("id,title,owner_id").eq("is_public", true);
  console.log("RLS test - Count:", data?.length, "Error:", error?.message);
  if (data) data.slice(0, 3).forEach(a => console.log(" ", a.title));
}
main();
