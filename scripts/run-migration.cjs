// 通过 Supabase REST API 执行 migration
// 需要 Supabase 管理 token（在 https://supabase.com/dashboard/account/tokens 生成）
const https = require("https");
const fs = require("fs");
const path = require("path");

const PROJECT_REF = "eujvciflkpoyftbyxokp";
const SERVICE_KEY = KEY;

// 使用 PostgREST 的 /rpc 端点来执行 SQL
// 先创建 exec_sql 函数
async function setupExecSql() {
  const sql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_text text) RETURNS void AS $$
    BEGIN EXECUTE sql_text; END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  return postgrestRequest("/rpc/exec_sql", { sql_text: sql }).catch(() => null);
}

async function postgrestRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: `/rest/v1${path}`,
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (d) => body += d);
      res.on("end", () => {
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${body}`));
        else resolve(JSON.parse(body || "{}"));
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("Running migration...");
  
  const sql = fs.readFileSync(path.join(__dirname, "migration-community.sql"), "utf-8");
  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await postgrestRequest("/rpc/exec_sql", { sql_text: stmt });
      console.log(`  ✓ ${stmt.substring(0, 60)}...`);
    } catch (e) {
      console.log(`  ⚠ ${stmt.substring(0, 60)}... → ${e.message}`);
    }
  }
  console.log("Done.");
}

main();
