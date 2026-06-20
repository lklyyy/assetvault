const { createClient } = require("@supabase/supabase-js");

const URL = "https://eujvciflkpoyftbyxokp.supabase.co";
const SERVICE_KEY = KEY;

async function main() {
  const admin = createClient(URL, SERVICE_KEY);

  // 直接查 storage schema 下的 policies
  console.log("→ 检查 storage schema 下的 policies...");
  
  // Try via raw SQL using rpc
  const res = await fetch(`${URL}/rest/v1/rpc/pgsodium_mask_role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  console.log("rpc test:", res.status);

  // Check if the schema is accessible
  const { data, error } = await admin.schema("storage").from("objects").select("count", { count: "exact", head: true });
  console.log("storage.objects:", error ? error.message : "OK, count rows accessible");

  // Try to check policies through the storage API
  const polRes = await fetch(`${URL}/storage/v1/bucket/assets/policies`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const polText = await polRes.text();
  console.log("\nStorage API policies:", polRes.status, polText.slice(0, 500));

  // Now try to create policy via storage management API
  console.log("\n→ 通过 Storage API 创建 INSERT 策略...");
  const createRes = await fetch(`${URL}/storage/v1/bucket/assets/policies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      name: "allow_insert",
      allowed: true,
      definition: JSON.stringify({ bucket_id: "assets" }),
    }),
  });
  console.log("Create policy:", createRes.status, await createRes.text());
}

main().catch(console.error);
