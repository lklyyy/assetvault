const { createClient } = require("@supabase/supabase-js");

const URL = "https://eujvciflkpoyftbyxokp.supabase.co";
const SERVICE_KEY = KEY;
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1anZjaWZsa3BveWZ0Ynl4b2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDA0MDUsImV4cCI6MjA5NzI3NjQwNX0.SisL7Ou0dzqQuqyaRylLGFOBfjsXDQSDpJ-rj1pgNgc";

async function main() {
  // 1. Test with service_role key
  console.log("→ 用 service_role key 上传测试...");
  const admin = createClient(URL, SERVICE_KEY);
  let { data, error } = await admin.storage.from("assets").upload("__test__.txt", new Blob(["ok"]), { upsert: true });
  console.log("Service key:", error ? "❌ " + error.message : "✅ 成功 " + data?.path);

  // 2. Try to create policy via SQL API
  console.log("\n→ 尝试通过 Management API 创建策略...");
  const projectRef = "eujvciflkpoyftbyxokp";
  // Management API needs personal access token - try without
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      query: "CREATE POLICY allow_up ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets');"
    }),
  });
  console.log("Management API:", mgmtRes.status, await mgmtRes.text());

  // 3. Test with anon key after potential fix
  console.log("\n→ 用 anon key 上传测试...");
  const anon = createClient(URL, ANON_KEY);
  // First login as anonymous (won't work without auth)
  let { data: d2, error: e2 } = await anon.storage.from("assets").upload("__test2__.txt", new Blob(["ok"]), { upsert: true });
  console.log("Anon key:", e2 ? "❌ " + e2.message : "✅ 成功 " + d2?.path);
}

main().catch(console.error);
