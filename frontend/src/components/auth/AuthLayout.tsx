import { type ReactNode } from 'react';
import { TrafficCone } from 'lucide-react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 p-4">
      <div className="pointer-events-none fixed inset-0 bg-grid-faint [background-size:40px_40px]" />
      <div className="pointer-events-none fixed inset-0 bg-radial-fade" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-ink-950 shadow-glow">
            <TrafficCone size={26} strokeWidth={2.5} />
          </div>
          <div className="mt-3 text-center">
            <div className="text-base font-semibold text-white">Johnson Road</div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
              Traffic Analytics
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-ink-900/60 p-6 shadow-pop backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
