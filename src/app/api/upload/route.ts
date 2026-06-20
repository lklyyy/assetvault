import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 用 service key 上传，完全绕过 RLS
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const path = formData.get("path") as string;

    if (!file || !userId) {
      return NextResponse.json({ error: "缺少文件或用户ID" }, { status: 400 });
    }

    const supabase = createClient(URL, SERVICE_KEY);
    const filePath = path || `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop()}`;

    const { data, error } = await supabase.storage
      .from("assets")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Upload error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(filePath);

    return NextResponse.json({ path: data.path, url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
