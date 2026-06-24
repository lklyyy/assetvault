import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eujvciflkpoyftbyxokp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1anZjaWZsa3BveWZ0Ynl4b2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDA0MDUsImV4cCI6MjA5NzI3NjQwNX0.SisL7Ou0dzqQuqyaRylLGFOBfjsXDQSDpJ-rj1pgNgc";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, prompt, title, model, tags, userId } = body;

    if (!imageUrl || !userId) {
      return NextResponse.json({ error: "缺少 imageUrl 或 userId" }, { status: 400 });
    }

    const supabase = createClient(URL, SERVICE_KEY || ANON_KEY);

    // 1. 下载图片
    let imageBuffer: ArrayBuffer;
    let mimeType = "image/png";
    let fileName = title || "imported";

    try {
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      imageBuffer = await resp.arrayBuffer();
      mimeType = resp.headers.get("content-type") || mimeType;
    } catch (e: any) {
      return NextResponse.json({ error: `下载图片失败: ${e.message}` }, { status: 400 });
    }

    // 2. 上传到 Supabase Storage
    const ext = mimeType.split("/")[1] || "png";
    const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("assets")
      .upload(storagePath, imageBuffer, { cacheControl: "3600", contentType: mimeType });

    if (uploadErr) {
      return NextResponse.json({ error: `上传失败: ${uploadErr.message}` }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(storagePath);

    // 3. 创建资产记录
    const { data: asset, error: insertErr } = await supabase
      .from("assets")
      .insert({
        owner_id: userId,
        type: "image",
        title: title || fileName + "-" + Date.now(),
        prompt: prompt || null,
        model: model || null,
        tags: tags || [],
        url: publicUrl,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: imageBuffer.byteLength,
        is_public: true,
      })
      .select("id,title,url")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: `入库失败: ${insertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, asset });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
