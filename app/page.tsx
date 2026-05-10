import UploadCard from "@/components/UploadCard";
import { Upload, BookOpen, Settings2 } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--surface-canvas)] text-[var(--ink-900)]">
      {/* Top tab bar — Reflect-style browser-tabs */}
      <div className="tab-bar tab-bar--fused">
        <div className="tab-item" data-active="true">
          <Upload className="h-3.5 w-3.5 text-[var(--accent-600)]" />
          <span>Upload</span>
        </div>
        <div className="tab-item">
          <BookOpen className="h-3.5 w-3.5 text-[var(--ink-400)]" />
          <span>Library</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="tab-icon-btn" aria-hidden>
            <Settings2 className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* White content sheet */}
      <div className="flex-1 bg-[var(--surface-raised)]">
        <UploadCard />
      </div>
    </main>
  );
}
