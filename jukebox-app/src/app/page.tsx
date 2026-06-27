import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold">🎵 點唱機 SaaS</h1>
      <p className="max-w-md text-[var(--muted)]">即時點歌系統。店家註冊開店、產生每桌 QR；客人掃碼點歌、平板登入播放。</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/signup" className="btn-ember rounded-xl px-6 py-3">註冊開店</Link>
        <Link href="/login" className="card rounded-xl px-6 py-3 font-bold">店家登入</Link>
      </div>
    </main>
  );
}
