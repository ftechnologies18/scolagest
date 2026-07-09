import type { ReactNode } from "react"
import { Lock, RefreshCw, ArrowLeft, ArrowRight } from "lucide-react"

export interface WireframeFrameProps {
  title: string
  description: string
  children: ReactNode
  url?: string
}

/**
 * Reusable "browser chrome" wrapper used to present each ScolaGest wireframe
 * on the Phase 0 validation page.
 */
export function WireframeFrame({
  title,
  description,
  children,
  url = "https://scolagest.ci/app",
}: WireframeFrameProps) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b bg-slate-100 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-rose-400" />
            <span className="size-3 rounded-full bg-amber-400" />
            <span className="size-3 rounded-full bg-emerald-400" />
          </div>
          <div className="ml-2 hidden items-center gap-1 text-slate-400 md:flex">
            <ArrowLeft className="size-3.5" />
            <ArrowRight className="size-3.5" />
            <RefreshCw className="size-3.5" />
          </div>
          <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-md border bg-white px-3 py-1 text-xs text-slate-500 shadow-xs">
            <Lock className="size-3 text-emerald-600" />
            <span className="truncate">{url}</span>
          </div>
        </div>

        {/* Screen */}
        <div className="bg-white">{children}</div>
      </div>
    </section>
  )
}
