import UploadCard from "@/components/UploadCard";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04060f] text-white">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-violet-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-sky-500/15 blur-[120px]" />
      </div>
      <div className="relative">
        <nav className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/20">
              <span className="text-sm font-bold text-white">B</span>
            </div>
            <span className="text-base font-semibold tracking-tight">
              Braynr <span className="text-white/50">Visualizer</span>
            </span>
          </div>
          <div className="hidden items-center gap-5 text-xs text-white/55 md:flex">
            <span>3D · 2D anim · formulas · graphs · sources</span>
          </div>
        </nav>
        <UploadCard />
      </div>
    </main>
  );
}
