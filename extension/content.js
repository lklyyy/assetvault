// AssetVault Qenda 导入 — Content Script
(function () {
  const API = "http://localhost:3000/api/import";

  // ========== Floating Button ==========
  function createButton() {
    const btn = document.createElement("div");
    btn.id = "av-import-btn";
    btn.innerHTML = "📥 导入 AssetVault";
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 12px 20px; border-radius: 30px;
      font-size: 14px; font-weight: bold; cursor: pointer;
      box-shadow: 0 4px 15px rgba(102,126,234,0.4);
      font-family: -apple-system, sans-serif;
      transition: transform 0.2s;
      display: none;
    `;
    btn.onmouseenter = () => (btn.style.transform = "scale(1.05)");
    btn.onmouseleave = () => (btn.style.transform = "scale(1)");
    btn.onclick = openImporter;
    return btn;
  }

  // ========== Extract Images + Prompts from Page ==========
  function extractContent() {
    const items = [];
    const seen = new Set();

    // Strategy 1: Find all visible images > 200x200
    document.querySelectorAll("img").forEach((img) => {
      if (!img.src || img.naturalWidth < 200 || img.naturalHeight < 200) return;
      if (seen.has(img.src)) return;
      seen.add(img.src);

      // Try to find prompt from alt text, aria-label, or nearby text
      let prompt = img.alt || "";
      if (!prompt || prompt.length < 10) {
        // Look for nearby text that looks like a prompt
        const parent = img.closest("div, section, article");
        if (parent) {
          const textNodes = parent.querySelectorAll("p, pre, textarea, [class*=prompt], [class*=text]");
          for (const node of textNodes) {
            const t = node.textContent?.trim() || "";
            if (t.length > 20 && t.length < 5000) {
              prompt = t;
              break;
            }
          }
        }
      }

      items.push({ type: "image", src: img.src, prompt, title: prompt?.slice(0, 50) || "Qenda 图片" });
    });

    // Strategy 2: Find background images and canvas
    document.querySelectorAll("canvas, video").forEach((el) => {
      if (el.tagName === "CANVAS") {
        try {
          const dataUrl = (el as HTMLCanvasElement).toDataURL("image/png");
          if (!seen.has(dataUrl)) {
            seen.add(dataUrl);
            items.push({ type: "canvas", src: dataUrl, prompt: "", title: "Canvas 图片" });
          }
        } catch {}
      }
    });

    return items;
  }

  // ========== Importer Modal ==========
  function openImporter() {
    const items = extractContent();
    if (items.length === 0) {
      alert("当前页面没有检测到大尺寸图片。请先到 Qenda 生成图片的页面，再点导入。");
      return;
    }

    // 移除旧弹窗
    document.getElementById("av-modal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "av-modal";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999999;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, sans-serif;
    `;

    let html = `
      <div style="background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin:0; font-size:18px;">检测到 ${items.length} 个可导入项</h3>
          <button onclick="this.closest('#av-modal').remove()" style="border:none; background:none; font-size:24px; cursor:pointer; color:#999;">×</button>
        </div>
        <div style="padding: 15px; display: flex; flex-direction: column; gap: 12px;">
    `;

    items.forEach((item, i) => {
      html += `
        <div style="display:flex; gap:12px; padding:10px; border:1px solid #eee; border-radius:8px; align-items:start;">
          <img src="${item.src}" style="width:100px; height:100px; object-fit:cover; border-radius:6px; flex-shrink:0;" onerror="this.style.display='none'" />
          <div style="flex:1; min-width:0;">
            <input type="text" placeholder="标题 (可选)" value="${escapeHtml(item.title)}" id="av-title-${i}" style="width:100%; border:1px solid #ddd; padding:6px 10px; border-radius:6px; font-size:13px; margin-bottom:6px;" />
            <textarea placeholder="Prompt / 提示词" id="av-prompt-${i}" rows="2" style="width:100%; border:1px solid #ddd; padding:6px 10px; border-radius:6px; font-size:12px; font-family:monospace;">${escapeHtml(item.prompt)}</textarea>
            <div style="display:flex; gap:6px; margin-top:6px;">
              <input type="text" placeholder="模型 (例: Midjourney)" id="av-model-${i}" style="flex:1; border:1px solid #ddd; padding:4px 8px; border-radius:6px; font-size:12px;" />
              <input type="text" placeholder="标签,逗号分隔" id="av-tags-${i}" style="flex:1; border:1px solid #ddd; padding:4px 8px; border-radius:6px; font-size:12px;" />
            </div>
            <button onclick="window.__avImport(${i})" style="margin-top:8px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px; font-weight:bold;">📥 导入此图片</button>
            <span id="av-status-${i}" style="margin-left:10px; font-size:12px;"></span>
          </div>
        </div>
      `;
    });

    html += "</div></div>";
    overlay.innerHTML = html;

    // Store items for button callbacks
    (window as any).__avItems = items;
    (window as any).__avImport = async function (i: number) {
      const item = (window as any).__avItems[i];
      const title = (document.getElementById(`av-title-${i}`) as HTMLInputElement)?.value || item.title;
      const prompt = (document.getElementById(`av-prompt-${i}`) as HTMLTextAreaElement)?.value || "";
      const model = (document.getElementById(`av-model-${i}`) as HTMLInputElement)?.value || "";
      const tags = (document.getElementById(`av-tags-${i}`) as HTMLInputElement)?.value
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
      const status = document.getElementById(`av-status-${i}`)!;

      status.textContent = "⏳ 导入中...";

      // Get user ID from AssetVault's localStorage
      const avSession = localStorage.getItem("supabase.auth.token");
      let userId = "";
      if (avSession) {
        try {
          const parsed = JSON.parse(avSession);
          userId = parsed?.currentSession?.user?.id || "";
        } catch {}
      }

      if (!userId) {
        status.textContent = "❌ 请先在 AssetVault 登录";
        return;
      }

      try {
        // Handle canvas data URL — convert to blob URL for fetching
        let imageUrl = item.src;
        if (imageUrl.startsWith("data:")) {
          const resp = await fetch(imageUrl);
          const blob = await resp.blob();
          imageUrl = URL.createObjectURL(blob);
        }

        const resp = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl, prompt, title, model, tags, userId }),
        });

        const result = await resp.json();
        if (result.success) {
          status.textContent = "✅ 导入成功！";
          status.style.color = "green";
        } else {
          status.textContent = "❌ " + (result.error || "失败");
          status.style.color = "red";
        }
      } catch (e) {
        status.textContent = "❌ 网络错误 — AssetVault 本地服务器在运行吗？";
        status.style.color = "red";
      }
    };

    document.body.appendChild(overlay);
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ========== Init ==========
  const btn = createButton();
  document.body.appendChild(btn);

  // Show button after page is loaded and has images
  function checkImages() {
    const imgs = document.querySelectorAll("img");
    const largeImgs = [...imgs].filter((i) => i.naturalWidth > 200 || i.naturalHeight > 200);
    btn.style.display = largeImgs.length > 0 ? "block" : "none";
  }

  window.addEventListener("load", checkImages);
  // Re-check periodically for dynamically loaded content
  setInterval(checkImages, 3000);

  // Keyboard shortcut: Ctrl+Shift+I to import
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "I") {
      e.preventDefault();
      openImporter();
    }
  });
})();
