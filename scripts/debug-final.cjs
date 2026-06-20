const { createClient } = require("@supabase/supabase-js");

const URL = "https://eujvciflkpoyftbyxokp.supabase.co";
const SERVICE_KEY = KEY;
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1anZjaWZsa3BveWZ0Ynl4b2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDA0MDUsImV4cCI6MjA5NzI3NjQwNX0.SisL7Ou0dzqQuqyaRylLGFOBfjsXDQSDpJ-rj1pgNgc";

async function main() {
  const admin = createClient(URL, SERVICE_KEY);

  // 1. 直接通过 service key 检查 storage.objects 表结构
  console.log("1. 检查 storage.objects...");
  // Insert a test row
  const { data: insData, error: insErr } = await admin
    .schema("storage")
    .from("objects")
    .insert({
      name: "__debug_test.txt",
      bucket_id: "assets",
      owner: "00000000-0000-0000-0000-000000000000",
      metadata: {},
    })
    .select();
  console.log("Insert test:", insErr ? insErr.message : "OK " + JSON.stringify(insData));
  
  // 2. Check if the policy exists
  console.log("\n2. 尝试通过 pg_policies 查看...");
  // Try to run raw SQL via edge function
  const res = await fetch(`${URL}/rest/v1/`, { 
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  
  // 3. Directly try with anon key but different approach
  console.log("\n3. 尝试完全开放的上传 policy...");

  // First, let's try a policy with no conditions at all
  const anon = createClient(URL, ANON_KEY);
  
  // Sign up and get a real user
  const email = `dbg${Date.now()}@test.com`;
  const pw = "password123";
  const { data: su } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  const { data: si } = await anon.auth.signInWithPassword({ email, password: pw });
  
  if (si.session) {
    console.log("Logged in as:", si.user.id);
    
    // Create authenticated client
    const authClient = createClient(URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${si.session.access_token}` } }
    });
    
    // Try upload
    const { data: up, error: upErr } = await authClient.storage
      .from("assets")
      .upload("test_auth_debug.txt", new Blob(["hello"]), { upsert: true });
    console.log("Auth upload:", upErr ? "FAIL: " + upErr.message : "SUCCESS: " + up?.path);
    
    // Check policies again
    // Now TRY TO CREATE POLICY via SQL-like RPC
    console.log("\n4. 尝试创建最小限制 policy...");
    // Use INSERT directly into storage.policies
    const polRes = await fetch(`${URL}/rest/v1/rpc/create_policy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        sql: "CREATE POLICY allow_all ON storage.objects FOR INSERT WITH CHECK (true);"
      }),
    });
    console.log("Create policy via rpc:", polRes.status, await polRes.text());
    
    // Try upload again
    const { data: up2, error: upErr2 } = await authClient.storage
      .from("assets")
      .upload("test_after_policy.txt", new Blob(["hello"]), { upsert: true });
    console.log("After policy upload:", upErr2 ? "FAIL: " + upErr2.message : "SUCCESS: " + up2?.path);
    
    // Clean up
    await admin.auth.admin.deleteUser(si.user.id);
  }
}

main().catch(console.error);
