// 创建演示账号
const { createClient } = require("@supabase/supabase-js");

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; const supabase = createClient(
  "https://eujvciflkpoyftbyxokp.supabase.co",
  KEY
);

async function main() {
  const accounts = [
    { email: "demo1@assetvault.local", password: "demo123456" },
    { email: "demo2@assetvault.local", password: "demo123456" },
    { email: "demo3@assetvault.local", password: "demo123456" },
  ];

  for (const acct of accounts) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
      user_metadata: { role: "demo" },
    });
    if (error) {
      console.log(`${acct.email}: ${error.message}`);
    } else {
      console.log(`${acct.email}: ✓ 创建成功 (${data.user.id})`);
    }
  }
}

main();
