import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center text-zinc-100">
      <h1 className="text-3xl font-bold">🎵 點唱機 SaaS</h1>
      <p className="max-w-md text-zinc-400">即時點歌系統。客人掃 QR 點歌、店家平板登入播放。</p>
      <div className="flex gap-3">
        <Link href="/c" className="rounded-xl bg-orange-500 px-6 py-3 font-bold text-zinc-900">客人點歌頁</Link>
        <Link href="/player" className="rounded-xl bg-white/10 px-6 py-3 font-bold">店家播放器</Link>
      </div>
    </main>
  );
}
