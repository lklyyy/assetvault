"use client";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">📦 AssetVault 桌面版</h1>
          <p className="text-xl text-purple-200 mb-8">本地 AI 素材管理 · 秒开看图 · 私有库</p>
          <a
            href="/dl/AssetVault-Setup.zip"
            className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-10 py-4 rounded-2xl text-lg font-bold hover:scale-105 transition-transform shadow-2xl"
          >
            ⬇ 下载 Windows 版
          </a>
          <p className="text-sm text-purple-300 mt-3">v1.0 · 约 80MB · 支持 Win10/11</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: "⚡", title: "本地极速", desc: "图片存本地硬盘，双击秒开，比云端快 10 倍" },
            { icon: "🔒", title: "数据私有", desc: "所有资料存你自己电脑，不上传任何服务器" },
            { icon: "🏷️", title: "智能管理", desc: "拖拽导入、AI 提示词标注、标签分类、评分筛选" },
          ].map((f) => (
            <div key={f.title} className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-purple-200">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Tutorial */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">📖 安装教程</h2>
          <div className="space-y-6">
            <Step num={1} title="下载安装包" desc="点击上方按钮下载 AssetVault-Setup.zip" />
            <Step num={2} title="解压" desc="右键 zip → 解压到当前文件夹" />
            <Step num={3} title="安装 Node.js（如已安装可跳过）" desc={<span>打开 <a href="https://nodejs.org/" className="text-green-400 underline" target="_blank">nodejs.org</a>，下载 LTS 版本安装</span>} />
            <Step num={4} title="运行安装脚本" desc="双击解压后的 AssetVault 文件夹里的 setup.bat，等待 2-3 分钟自动完成" />
            <Step num={5} title="开始使用" desc="浏览器自动打开 http://localhost:3000，注册账号即可使用" />
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">💻 系统要求</h2>
          <ul className="space-y-2 text-purple-200">
            <li>✅ Windows 10 / 11（64位）</li>
            <li>✅ Node.js 18+（安装脚本会自动检测）</li>
            <li>✅ 2GB 以上内存</li>
            <li>✅ 500MB 磁盘空间</li>
          </ul>
        </div>

        {/* FAQ */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">❓ 常见问题</h2>
          <Q title="图片存在哪里？" answer="图片默认存在您电脑的用户目录下的 AssetVault 缓存文件夹中，不会上传到任何云端。" />
          <Q title="可以多台电脑共用吗？" answer="可以。每台电脑安装后登录同一个账号，数据通过加密通道同步。" />
          <Q title="Mac 能用吗？" answer="Mac 版正在开发中，目前可以在 Mac 上使用网页版 assetvault.work" />
          <Q title="安装失败怎么办？" answer="确保已安装 Node.js，右键 setup.bat 以管理员身份运行。" />
        </div>

        <p className="text-center text-sm text-purple-400 mt-12">
          AssetVault v1.0 · 本地版 + 云端同步 · 开源免费
        </p>
      </div>
    </div>
  );
}

function Step({ num, title, desc }: { num: number; title: string; desc: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center font-bold flex-shrink-0">{num}</div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-purple-200">{desc}</p>
      </div>
    </div>
  );
}

function Q({ title, answer }: { title: string; answer: string }) {
  return (
    <div className="mb-3">
      <p className="font-semibold text-purple-200">Q: {title}</p>
      <p className="text-sm text-purple-300">A: {answer}</p>
    </div>
  );
}
