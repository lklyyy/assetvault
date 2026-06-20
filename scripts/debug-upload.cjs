const { createClient } = require("@supabase/supabase-js");

const URL = "https://eujvciflkpoyftbyxokp.supabase.co";
const SERVICE_KEY = KEY;
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1anZjaWZsa3BveWZ0Ynl4b2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDA0MDUsImV4cCI6MjA5NzI3NjQwNX0.SisL7Ou0dzqQuqyaRylLGFOBfjsXDQSDpJ-rj1pgNgc";

async function main() {
  const admin = createClient(URL, SERVICE_KEY);

  // Check existing policies by trying SQL
  console.log("→ 检查 storage policies...");
  const { data: policies, error: polErr } = await admin
    .from("storage.policies")
    .select("*");
  console.log("storage.policies:", polErr ? polErr.message : JSON.stringify(policies));

  // Also check via raw SQL
  console.log("\n→ 通过 pg_catalog 查 policies...");
  const res = await fetch(`${URL}/rest/v1/`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  
  // Try upload as authenticated user
  console.log("\n→ 模拟用户登录并上传...");
  // Create a test user
  const testEmail = `test_${Date.now()}@example.com`;
  const testPass = "test123456";
  
  const { data: signUpData, error: signUpErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPass,
    email_confirm: true,
  });
  
  if (signUpErr) {
    console.log("创建测试用户失败:", signUpErr.message);
    // Try signing in with existing user
    const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
      email: "test@example.com",
      password: "test123456",
    });
    if (signInErr) {
      console.log("登录也失败:", signInErr.message);
      return;
    }
    // Got a session, try upload
    const userClient = createClient(URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
    });
    const { data: upData, error: upErr } = await userClient.storage
      .from("assets")
      .upload("test_auth.txt", new Blob(["test"]), { upsert: true });
    console.log("已登录用户上传:", upErr ? "❌ " + upErr.message : "✅ 成功 " + upData?.path);
    return;
  }

  // New user created, now sign in
  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({
    email: testEmail,
    password: testPass,
  });
  if (signInErr) {
    console.log("登录失败:", signInErr.message);
    return;
  }

  const userClient = createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
  });
  const { data: upData, error: upErr } = await userClient.storage
    .from("assets")
    .upload("test_newuser.txt", new Blob(["test"]), { upsert: true });
  console.log("新用户上传:", upErr ? "❌ " + upErr.message : "✅ 成功 " + upData?.path);

  // Clean up
  await admin.auth.admin.deleteUser(signIn.user.id);
  console.log("✓ 清理完成");
}

main().catch(console.error);
