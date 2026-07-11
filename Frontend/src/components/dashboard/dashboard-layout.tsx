"use client";

/**
 * ScolaGest — Coquille du tableau de bord (dashboard shell)
 *
 * Sidebar (collapsible sur mobile via un Sheet), topbar (titre de page,
 * recherche, notifications, menu utilisateur) et zone de contenu principal
 * qui change selon la vue active (état `activeView` local). Pied de page en
 * bas de page.
 *
 * La navigation est filtrée par rôle (RBAC). Exporte `NAV_GROUPS` et
 * `ViewId` pour permettre à d'autres composants de connaître la liste des
 * vues et leurs restrictions d'accès.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  AlertTriangle,
  FileBarChart,
  Coins,
  CalendarDays,
  UserCog,
  BookOpen,
  Smartphone,
  Settings,
  Menu,
  Search,
  Bell,
  LogOut,
  Building2,
  ChevronDown,
  CheckCircle2,
  LifeBuoy,
  ScrollText,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthStore, type Etablissement, type Role } from "@/lib/auth-store";
import { apiGet } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

import { DashboardHome, type DashboardViewId } from "./dashboard-home";
import ElevesView from "./views/view-eleves";
import CaisseView from "./views/view-caisse";
import ImpayesView from "./views/view-impayes";
import RapportsView from "./views/view-rapports";
import FraisView from "./views/view-frais";
import AnneesView from "./views/view-annees";
import UtilisateursView from "./views/view-utilisateurs";
import ComptabiliteView from "./views/view-comptabilite";
import MobileMoneyView from "./views/view-mobile-money";
import ParametresView from "./views/view-parametres";
import SaasDashboardView from "./views/view-saas-dashboard";
import SaasEstablishmentsView from "./views/view-saas-establishments";
import SaasAuditView from "./views/view-saas-audit";
import SaasSupportView from "./views/view-saas-support";
import SaasBillingView from "./views/view-saas-billing";

/** Identifiants de vues gérées par la coquille. */
export type ViewId = DashboardViewId;

interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  /** Rôles autorisés. Si `undefined`, tous les rôles. */
  roles?: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Groupes de navigation pour le personnel d'établissement (DIRECTION,
 * CAISSIER, COMPTABLE, SECRETARIAT). DIRECTION gère le pilotage et la
 * configuration, mais n'accède PAS à la caisse ni à Mobile Money
 * (réservés au CAISSIER / COMPTABLE).
 */
const STAFF_NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      {
        id: "dashboard",
        label: "Tableau de bord",
        icon: LayoutDashboard,
        roles: ["CAISSIER", "COMPTABLE", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        id: "eleves",
        label: "Élèves",
        icon: Users,
        roles: ["CAISSIER", "COMPTABLE", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        // Caisse : réservée au CAISSIER et au COMPTABLE (encaissement,
        // clôture, reçus). La direction n'y accède pas.
        id: "caisse",
        label: "Caisse",
        icon: Wallet,
        roles: ["CAISSIER", "COMPTABLE"],
      },
      {
        id: "impayes",
        label: "Impayés & relances",
        icon: AlertTriangle,
        roles: ["CAISSIER", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "COMPTABLE"],
      },
      {
        id: "rapports",
        label: "Rapports",
        icon: FileBarChart,
        roles: ["CAISSIER", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "COMPTABLE", "SECRETARIAT"],
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        id: "frais",
        label: "Frais & échéanciers",
        icon: Coins,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        id: "annees",
        label: "Années scolaires",
        icon: CalendarDays,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        id: "utilisateurs",
        label: "Utilisateurs",
        icon: UserCog,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
    ],
  },
  {
    label: "Modules avancés",
    items: [
      {
        // Comptabilité : réservé au COMPTABLE seul (séparation des responsabilités).
        id: "comptabilite",
        label: "Comptabilité",
        icon: BookOpen,
        roles: ["COMPTABLE"],
      },
      {
        // Mobile Money : réservé au CAISSIER (guichet MoMo). La direction
        // n'y accède pas.
        id: "mobile-money",
        label: "Mobile Money",
        icon: Smartphone,
        roles: ["CAISSIER"],
      },
      {
        id: "parametres",
        label: "Paramètres",
        icon: Settings,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
    ],
  },
];

/**
 * Groupes de navigation SaaS réservés au `SUPER_ADMIN` (propriétaire de la
 * plateforme). Le SUPER_ADMIN n'a pas accès aux données d'établissement
 * sauf si le mode support est activé.
 */
const SAAS_NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage SaaS",
    items: [
      {
        id: "saas-dashboard",
        label: "Tableau de bord SaaS",
        icon: LayoutDashboard,
        roles: ["SUPER_ADMIN"],
      },
      {
        id: "saas-establishments",
        label: "Établissements",
        icon: Building2,
        roles: ["SUPER_ADMIN"],
      },
      {
        id: "saas-audit",
        label: "Audit",
        icon: ScrollText,
        roles: ["SUPER_ADMIN"],
      },
      {
        id: "saas-billing",
        label: "Facturation",
        icon: CreditCard,
        roles: ["SUPER_ADMIN"],
      },
      {
        id: "saas-support",
        label: "Mode Support",
        icon: LifeBuoy,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
];

/** Liste fusionnée des groupes de navigation (exportée pour usage externe). */
export const NAV_GROUPS: NavGroup[] = [
  ...STAFF_NAV_GROUPS,
  ...SAAS_NAV_GROUPS,
];

function roleLabel(role: string | null): string {
  if (!role) return "Utilisateur";
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super Admin (SaaS)",
    CAISSIER: "Caissier(ère)",
    COMPTABLE: "Comptable",
    DIRECTION: "Direction",
  DIRECTEUR_ETUDES: "Directeur des Études",
  DIRECTEUR_SUPERVISEUR: "Directeur Superviseur",
    SECRETARIAT: "Secrétariat",
    PARENT: "Parent / Tuteur",
  };
  return map[role] ?? role;
}

function initials(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function findNavItem(viewId: ViewId): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    const found = group.items.find((it) => it.id === viewId);
    if (found) return found;
  }
  return undefined;
}

function isItemAllowed(item: NavItem, role: string | null): boolean {
  if (!item.roles) return true;
  if (!role) return false;
  return item.roles.includes(role as Role);
}

/**
 * Vue par défaut selon le rôle. Le SUPER_ADMIN arrive sur le tableau de bord
 * SaaS, les autres rôles sur le tableau de bord d'établissement.
 */
function defaultViewForRole(role: string | null): ViewId {
  return role === "SUPER_ADMIN" ? "saas-dashboard" : "dashboard";
}

export function DashboardLayout() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const etablissement = useAuthStore((s) => s.etablissement);
  const setEtablissement = useAuthStore((s) => s.setEtablissement);
  const logout = useAuthStore((s) => s.logout);

  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [loadingEtabs, setLoadingEtabs] = useState(true);

  // Charge la liste des établissements (pour le sélecteur multi-sites).
  // Non pertinent pour le SUPER_ADMIN (il gère tous les tenants via SaaS).
  useEffect(() => {
    if (role === "SUPER_ADMIN") {
      setLoadingEtabs(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<Etablissement[]>("/api/etablissements");
        if (!cancelled) setEtablissements(data || []);
      } catch {
        // silencieux
      } finally {
        if (!cancelled) setLoadingEtabs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Filtrage RBAC des groupes de navigation. Le SUPER_ADMIN ne voit que les
  // vues SaaS, les autres rôles ne voient que les vues d'établissement.
  const visibleGroups = useMemo<NavGroup[]>(() => {
    const sourceGroups =
      role === "SUPER_ADMIN" ? SAAS_NAV_GROUPS : STAFF_NAV_GROUPS;
    return sourceGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((it) => isItemAllowed(it, role)),
      }))
      .filter((g) => g.items.length > 0);
  }, [role]);

  // Si la vue active devient invisible (changement de rôle), on revient à la
  // vue par défaut du rôle courant.
  useEffect(() => {
    const current = findNavItem(activeView);
    if (!current || !isItemAllowed(current, role)) {
      setActiveView(defaultViewForRole(role));
    }
  }, [role, activeView]);

  const activeItem = findNavItem(activeView);
  const pageTitle = activeItem?.label ?? "Tableau de bord";

  function handleNavigate(view: ViewId) {
    setActiveView(view);
    setMobileOpen(false);
    // Scroll en haut lors du changement de vue
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleEtablissementChange(value: string) {
    if (value === "all") {
      setEtablissement(null);
      return;
    }
    const found = etablissements.find((e) => e.id === value);
    setEtablissement(found ?? null);
  }

  async function handleLogout() {
    await logout();
    toast({
      title: "Déconnexion",
      description: "Vous avez été déconnecté avec succès.",
    });
    // Navigation dure (cf. dashboard-shell.tsx) — redirection garantie.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  const etablissementSelectValue = etablissement?.id ?? "all";

  // Contenu de la sidebar (réutilisé pour desktop ET mobile Sheet)
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / marque */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b px-4">
        <Image
          src="/logo.png"
          alt="ScolaGest"
          width={36}
          height={36}
          className="rounded-lg shadow-sm"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">ScolaGest</p>
          <p className="truncate text-[10px] text-muted-foreground leading-tight">
            Groupe Le Chandelier — Dabou
          </p>
        </div>
      </div>

      {/* Sélecteur d'établissement (masqué pour le SUPER_ADMIN) */}
      {role !== "SUPER_ADMIN" && (
        <div className="shrink-0 border-b p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Building2 className="size-3" />
            Établissement actif
          </p>
          <Select
            value={etablissementSelectValue}
            onValueChange={handleEtablissementChange}
            disabled={loadingEtabs || etablissements.length === 0}
          >
            <SelectTrigger className="w-full bg-muted/40">
              <SelectValue
                placeholder={
                  loadingEtabs ? "Chargement…" : "Tous établissements"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous établissements</SelectItem>
              {etablissements.map((etab) => (
                <SelectItem key={etab.id} value={etab.id}>
                  {etab.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="space-y-5 p-3">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={cn(
                          "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-foreground/80 hover:bg-emerald-50 hover:text-emerald-700",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active
                              ? "text-white"
                              : "text-muted-foreground group-hover:text-emerald-600",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {active && (
                          <CheckCircle2 className="ml-auto size-3.5 text-white/90" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Carte utilisateur en bas */}
      <div className="shrink-0 border-t p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-2">
          <Avatar className="size-8 border">
            <AvatarFallback className="bg-emerald-600 text-white text-[11px] font-semibold">
              {initials(user?.nom, user?.prenoms)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-tight">
              {user
                ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() || user.email
                : "Utilisateur"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground leading-tight">
              {roleLabel(role)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 border-r bg-background lg:flex lg:flex-col">
          {sidebarContent}
        </aside>

        {/* Sidebar mobile (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation ScolaGest</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Colonne principale */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </Button>

            <div className="flex flex-col">
              <h1 className="text-base font-semibold leading-tight">
                {pageTitle}
              </h1>
              <p className="hidden text-[11px] text-muted-foreground leading-tight sm:block">
                ScolaGest · Gestion &amp; Caisse Scolaire
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {/* Recherche (placeholder non fonctionnel) */}
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un élève, un reçu…"
                  className="h-9 w-56 pl-8 lg:w-72"
                  aria-label="Recherche"
                />
              </div>

              {/* Notifications (placeholder) */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative"
              >
                <Bell className="size-5" />
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-500" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Menu utilisateur */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent transition-colors"
                  >
                    <Avatar className="size-8 border">
                      <AvatarFallback className="bg-emerald-600 text-white text-[11px] font-semibold">
                        {initials(user?.nom, user?.prenoms)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden flex-col items-start leading-tight sm:flex">
                      <span className="text-xs font-medium">
                        {user
                          ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() ||
                            user.email
                          : "Utilisateur"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {roleLabel(role)}
                      </span>
                    </span>
                    <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {user
                        ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() ||
                          user.email
                        : "Utilisateur"}
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {user?.email}
                    </span>
                    <Badge
                      variant="outline"
                      className="mt-1 w-fit border-emerald-300 text-emerald-700 text-[10px]"
                    >
                      {roleLabel(role)}
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      handleLogout();
                    }}
                    variant="destructive"
                  >
                    <LogOut className="size-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Contenu principal */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
              {activeView === "dashboard" && (
                <DashboardHome onNavigate={handleNavigate} />
              )}
              {activeView === "eleves" && <ElevesView />}
              {activeView === "caisse" && <CaisseView />}
              {activeView === "impayes" && <ImpayesView />}
              {activeView === "rapports" && <RapportsView />}
              {activeView === "frais" && <FraisView />}
              {activeView === "annees" && <AnneesView />}
              {activeView === "utilisateurs" && <UtilisateursView />}
              {activeView === "comptabilite" && <ComptabiliteView />}
              {activeView === "mobile-money" && <MobileMoneyView />}
              {activeView === "parametres" && <ParametresView />}
              {activeView === "saas-dashboard" && (
                <SaasDashboardView
                  onNavigate={(v) =>
                    handleNavigate(
                      v as
                        | "saas-establishments"
                        | "saas-audit"
                        | "saas-billing"
                        | "saas-support",
                    )
                  }
                />
              )}
              {activeView === "saas-establishments" && (
                <SaasEstablishmentsView
                  onNavigateSupport={() => handleNavigate("saas-support")}
                />
              )}
              {activeView === "saas-audit" && <SaasAuditView />}
              {activeView === "saas-billing" && <SaasBillingView />}
              {activeView === "saas-support" && <SaasSupportView />}
            </div>

            {/* Pied de page */}
            <footer className="mt-auto border-t bg-background">
              <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
                <p>
                  ScolaGest · Application de Gestion &amp; Caisse Scolaire —
                  Freelance Technologies Côte d&apos;Ivoire
                </p>
                <p className="text-[11px]">
                  Phase 1 — Socle technique · Collège Privé Le Chandelier,
                  Dabou
                </p>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
