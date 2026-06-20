// Direct REST: create storage policies
const URL = "https://eujvciflkpoyftbyxokp.supabase.co";
const SERVICE_KEY = KEY;

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function main() {
  // Check existing policies
  console.log("→ 检查现有策略...");
  let res = await fetch(`${URL}/rest/v1/storage/policies?select=*`, { headers });
  let data = await res.json();
  console.log("现有策略:", data.length, "条");

  // Create INSERT policy via storage API
  console.log("\n→ 创建 INSERT 策略...");
  res = await fetch(`${URL}/rest/v1/storage/policies`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "allow_upload_assets",
      definition: "(bucket_id = 'assets'::text AND auth.role() = 'authenticated'::text)",
      bucket_id: "assets",
      operation: "INSERT",
    }),
  });
  console.log("INSERT:", res.status, await res.text());

  // Create DELETE policy
  console.log("→ 创建 DELETE 策略...");
  res = await fetch(`${URL}/rest/v1/storage/policies`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "allow_delete_own_assets",
      definition: "(bucket_id = 'assets'::text AND (auth.uid())::text = (owner)::text)",
      bucket_id: "assets",
      operation: "DELETE",
    }),
  });
  console.log("DELETE:", res.status, await res.text());

  console.log("\n✓ 完成");
}

main().catch(console.error);
