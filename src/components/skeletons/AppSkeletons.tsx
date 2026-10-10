// Route-level loading skeletons for the full-screen app routes (AtelierFit, StitchBook, PhoneFrame, admin).
// Each one mirrors the real first screen of that app: same frame, same blocks, same sizes. They show while the
// app's code is still downloading, so the visitor never sees a generic spinner or a made-up placeholder shape.
import type { CSSProperties } from "react";

const bar = (w: number | string, h: number, r = 8, extra: CSSProperties = {}): CSSProperties => ({
  width: w,
  height: h,
  borderRadius: r,
  ...extra,
});

function B({ style, className = "" }: { style: CSSProperties; className?: string }) {
  return <div className={`silver-shimmer ${className}`} style={style} aria-hidden="true" />;
}

/** AtelierFit's first screen: the phone-width app shell with the splash (orb, name, tagline, two buttons). */
export function AtelierFitSkeleton() {
  return (
    <div className="min-h-dvh w-full flex justify-center" style={{ background: "#0B0A08" }} role="status" aria-label="Loading AtelierFit">
      <div className="w-full max-w-[430px] min-h-dvh flex flex-col items-center justify-center text-center gap-8 px-6 pb-10">
        <div className="flex flex-col items-center gap-4 w-full">
          <B style={bar(128, 128, 999)} />
          <B style={bar(150, 12, 6, { marginTop: 8 })} />
          <B style={bar(190, 34, 8)} />
          <B style={bar(260, 14, 6)} />
          <B style={bar(210, 14, 6)} />
        </div>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <B style={bar("100%", 52, 999)} />
          <B style={bar("100%", 52, 999)} />
          <B style={bar(180, 12, 6, { alignSelf: "center", marginTop: 6 })} />
        </div>
      </div>
    </div>
  );
}

/** StitchBook's first screen: sidebar, header row, stat cards and the orders table. */
export function StitchBookSkeleton() {
  return (
    <div className="min-h-dvh w-full flex" style={{ background: "#0B0A08" }} role="status" aria-label="Loading StitchBook">
      <aside className="hidden md:flex w-60 shrink-0 flex-col gap-3 p-5 border-r border-white/10">
        <B style={bar(140, 28, 8, { marginBottom: 20 })} />
        {Array.from({ length: 6 }).map((_, i) => (
          <B key={i} style={bar("100%", 40, 12)} />
        ))}
      </aside>
      <main className="flex-1 min-w-0 p-5 md:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <B style={bar(220, 32, 8)} />
          <div className="flex gap-3">
            <B style={bar(96, 40, 999)} />
            <B style={bar(40, 40, 999)} />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-3">
              <B style={bar(90, 12, 6)} />
              <B style={bar(110, 30, 8)} />
              <B style={bar(70, 10, 6)} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
          <div className="flex gap-3">
            {[120, 160, 100, 90].map((w, i) => (
              <B key={i} style={bar(w, 14, 6)} />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, r) => (
            <div key={r} className="flex items-center gap-3">
              <B style={bar(36, 36, 999)} />
              <B style={bar("22%", 14, 6)} />
              <B style={bar("30%", 14, 6)} />
              <B style={bar("14%", 14, 6)} />
              <B style={bar(72, 26, 999, { marginLeft: "auto" })} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/** PhoneFrame showcase: the phone mockup centred, with its configurator panel beside it. */
export function PhoneFrameSkeleton() {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center gap-12 p-6 flex-wrap" style={{ background: "#0B0A08" }} role="status" aria-label="Loading PhoneFrame">
      <B style={bar(300, 620, 52)} />
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <B style={bar(200, 34, 8)} />
        <B style={bar("100%", 14, 6)} />
        <B style={bar("85%", 14, 6)} />
        {Array.from({ length: 4 }).map((_, i) => (
          <B key={i} style={bar("100%", 48, 14)} />
        ))}
      </div>
    </div>
  );
}

/** Admin pages: a content area with a heading, toolbar and table, inside the admin layout. */
export function AdminPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-1" role="status" aria-label="Loading">
      <div className="flex items-center justify-between gap-4">
        <B style={bar(220, 34, 8)} />
        <B style={bar(120, 40, 12)} />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="flex items-center gap-3">
            <B style={bar("26%", 14, 6)} />
            <B style={bar("34%", 14, 6)} />
            <B style={bar("16%", 14, 6)} />
            <B style={bar(64, 24, 999, { marginLeft: "auto" })} />
          </div>
        ))}
      </div>
    </div>
  );
}
