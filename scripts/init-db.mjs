/**
 * 一键初始化 Supabase 数据库
 *
 * 使用方式：
 *   node scripts/init-db.mjs
 *
 * 前提：.env.local 中已配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
 *
 * 如果无法自动执行 SQL，脚本会输出手动操作指引
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

// 解析 .env.local
function loadEnv(path) {
  if (!existsSync(path)) {
    console.error("❌ 未找到 .env.local，请先运行 setup.bat 配置环境变量");
    process.exit(1);
  }
  const content = readFileSync(path, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnv(envPath);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
  console.error("❌ 请在 .env.local 中填入真实的 Supabase URL");
  process.exit(1);
}

console.log("✓ Supabase URL:", supabaseUrl);
console.log("");

// 读取 SQL 文件
const sqlPath = resolve(__dirname, "..", "supabase-schema.sql");
const sql = readFileSync(sqlPath, "utf-8");

// 如果有 service_role key，尝试通过 API 执行 SQL
if (serviceRoleKey && !serviceRoleKey.includes("placeholder")) {
  console.log("→ 正在通过 Management API 执行 SQL...");

  try {
    // Supabase v1 Management API - 执行 SQL
    const managementUrl = `https://api.supabase.com/v1/projects/${supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]}/database/query`;

    // 使用 SQL API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (response.ok) {
      console.log("✓ 数据库初始化成功！");
    } else {
      const err = await response.text();
      throw new Error(err);
    }
  } catch (e) {
    console.warn("⚠ 自动执行失败:", e.message);
    console.log("");
    console.log("请手动操作：");
    printManualSteps(supabaseUrl);
  }
} else {
  console.log("未配置 SUPABASE_SERVICE_ROLE_KEY，无法自动执行 SQL");
  console.log("");
  console.log("请手动操作：");
  printManualSteps(supabaseUrl);
}

function printManualSteps(url) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. 打开 Supabase Dashboard:");
  console.log(`   ${url}`);
  console.log("");
  console.log("2. 进入左侧菜单 → SQL Editor");
  console.log("");
  console.log("3. 点击 New Query");
  console.log("");
  console.log("4. 复制 supabase-schema.sql 的全部内容粘贴进去");
  console.log("");
  console.log("5. 点击 Run（或 Ctrl+Enter）");
  console.log("");
  console.log("6. 进入左侧菜单 → Storage → New bucket");
  console.log("   创建名为「assets」的公开存储桶");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("完成后运行: npm run dev");
}
