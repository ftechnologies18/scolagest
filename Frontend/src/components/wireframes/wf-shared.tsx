import type { ComponentProps, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  Banknote,
  ReceiptText,
  Wallet,
  FileBarChart,
  Settings,
  CalendarDays,
  ShieldCheck,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Menu,
  GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

/* -------------------------------------------------------------------------- */
/*  Annotation badges                                                         */
/* -------------------------------------------------------------------------- */

type AnnotationTone = "amber" | "emerald" | "rose" | "slate"

const annotationTones: Record<AnnotationTone, string> = {
  amber: "border-amber-300 bg-amber-100 text-amber-800",
  emerald: "border-emerald-300 bg-emerald-100 text-emerald-800",
  rose: "border-rose-300 bg-rose-100 text-rose-800",
  slate: "border-slate-300 bg-slate-100 text-slate-700",
}

export function AnnotationBadge({
  children,
  tone = "amber",
}: {
  children: ReactNode
  tone?: AnnotationTone
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        annotationTones[tone],
      )}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Themed buttons (emerald primary, amber accent)                            */
/* -------------------------------------------------------------------------- */

export function PrimaryButton({
  className,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      className={cn(
        "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

export function AccentButton({
  className,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      className={cn(
        "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Mock app shell (sidebar + topbar)                                         */
/* -------------------------------------------------------------------------- */

type NavKey =
  | "dashboard"
  | "students"
  | "cash"
  | "receipts"
  | "outstanding"
  | "reports"
  | "fees"
  | "years"
  | "settings"
  | "users"
  | "momo"
  | "accounting"
  | "closure"
  | "parent"

export function MockAppShell({
  activeKey = "dashboard",
  establishment = "Collège Privé Le Chandelier",
  role = "Administrateur",
  userName = "Koffi Marc",
  badge,
  children,
}: {
  activeKey?: NavKey
  establishment?: string
  role?: string
  userName?: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[660px] w-full flex-col overflow-hidden rounded-lg border bg-white text-sm md:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-emerald-50/40 md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-600 font-bold text-white">
            S
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight">ScolaGest</div>
            <div className="text-[10px] text-muted-foreground">
              Gestion & Caisse
            </div>
          </div>
        </div>

        <div className="border-b px-3 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Établissement
          </div>
          <div className="mt-1 flex items-center justify-between rounded-md border bg-white px-2 py-1.5 text-xs">
            <span className="truncate">{establishment}</span>
            <ChevronDown className="size-3.5 opacity-50" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <NavSection title="Pilotage">
            <NavItem
              icon={LayoutDashboard}
              label="Tableau de bord"
              active={activeKey === "dashboard"}
            />
            <NavItem icon={Users} label="Élèves" active={activeKey === "students"} />
            <NavItem
              icon={Banknote}
              label="Caisse — encaissement"
              active={activeKey === "cash"}
            />
            <NavItem
              icon={ReceiptText}
              label="Reçus"
              active={activeKey === "receipts"}
            />
            <NavItem
              icon={Wallet}
              label="Impayés & relances"
              active={activeKey === "outstanding"}
              count={12}
            />
            <NavItem
              icon={FileBarChart}
              label="Rapports"
              active={activeKey === "reports"}
            />
            <NavItem
              icon={Banknote}
              label="Clôture de caisse"
              active={activeKey === "closure"}
            />
          </NavSection>

          <NavSection title="Configuration">
            <NavItem
              icon={Banknote}
              label="Frais & échéanciers"
              active={activeKey === "fees"}
            />
            <NavItem
              icon={CalendarDays}
              label="Années scolaires"
              active={activeKey === "years"}
            />
            <NavItem
              icon={Settings}
              label="Paramètres"
              active={activeKey === "settings"}
            />
            <NavItem
              icon={ShieldCheck}
              label="Utilisateurs & rôles"
              active={activeKey === "users"}
            />
          </NavSection>

          <NavSection title="Modules avancés">
            <NavItem
              icon={Wallet}
              label="Mobile Money"
              active={activeKey === "momo"}
              ext
            />
            <NavItem
              icon={FileBarChart}
              label="Comptabilité générale"
              active={activeKey === "accounting"}
              ext
            />
            <NavItem
              icon={GraduationCap}
              label="Portail parents"
              active={activeKey === "parent"}
              ext
            />
          </NavSection>
        </nav>

        <div className="flex items-center gap-2 border-t p-3">
          <Avatar>
            <AvatarFallback className="bg-emerald-600 text-white">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{userName}</div>
            <div className="text-[10px] text-muted-foreground">{role}</div>
          </div>
          <LogOut className="size-4 text-muted-foreground" />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b bg-white px-4">
          <Menu className="size-4 md:hidden" />
          <div className="relative hidden w-64 md:block">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un élève, un reçu…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {badge}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-xs text-muted-foreground md:block">
              Année 2024–2025 · 2<sup>e</sup> trimestre
            </div>
            <div className="relative">
              <Bell className="size-4" />
              <span className="absolute -right-1 -top-1 size-2 rounded-full bg-rose-500" />
            </div>
            <Separator orientation="vertical" className="h-5" />
            <Avatar>
              <AvatarFallback className="bg-emerald-600 text-xs text-white">
                {initials(userName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="flex-1 bg-muted/30 p-4">{children}</div>
      </div>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function NavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  count,
  ext,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  count?: number
  ext?: boolean
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs",
        active
          ? "bg-emerald-600 font-medium text-white"
          : "text-slate-600 hover:bg-emerald-100/60",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            active ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700",
          )}
        >
          {count}
        </span>
      )}
      {ext && (
        <span
          className="size-1.5 rounded-full bg-amber-400"
          title="V1 étendu"
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small reusable bits                                                       */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

export function FieldRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}

/** Static "select-like" field used to avoid wiring real Select state everywhere. */
export function StaticSelect({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-sm text-slate-700 shadow-xs",
        className,
      )}
    >
      <span className="truncate">{value}</span>
      <ChevronDown className="size-4 opacity-50" />
    </div>
  )
}

export function KpiCard({
  label,
  value,
  sub,
  tone = "emerald",
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  tone?: "emerald" | "amber" | "rose" | "slate"
  icon?: LucideIcon
}) {
  const toneRing: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    slate: "border-slate-200 bg-slate-50",
  }
  const toneIcon: Record<string, string> = {
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-500 text-white",
    slate: "bg-slate-600 text-white",
  }
  return (
    <div className={cn("rounded-xl border p-4", toneRing[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-slate-600">{label}</div>
        {Icon && (
          <div
            className={cn(
              "flex size-7 items-center justify-center rounded-lg",
              toneIcon[tone],
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

/** Simple bar-chart placeholder built with divs. */
export function MiniBars({
  data,
}: {
  data: { label: string; value: number; tone?: string }[]
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-md", d.tone ?? "bg-emerald-500")}
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground">{d.label}</div>
          <div className="text-[10px] font-semibold">
            {Math.round((d.value / 1000) * 10) / 10}M
          </div>
        </div>
      ))}
    </div>
  )
}

/** Donut-ish placeholder built with a conic gradient. */
export function MiniDonut({
  percent,
  label,
  tone = "#059669",
}: {
  percent: number
  label: string
  tone?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex size-24 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${tone} ${percent}%, #e2e8f0 ${percent}% 100%)`,
        }}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-white">
          <span className="text-sm font-bold">{percent}%</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
