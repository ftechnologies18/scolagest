"use client";

/**
 * ScolaGest — Coquille partagée du tableau de bord (dashboard shell).
 *
 * Sidebar (collapsible sur mobile via un Sheet), topbar (titre de page dérivé
 * du `usePathname`, recherche, notifications, menu utilisateur) et zone de
 * contenu principal (`{children}`). Pied de page en bas de page.
 *
 * La navigation est filtrée par rôle (RBAC). Les liens utilisent `<Link>` de
 * `next/link` et l'item actif est détecté via `usePathname()`.
 *
 * Cette coquille est partagée par `(staff)/layout.tsx` (personnel
 * d'établissement) et `(saas)/layout.tsx` (SUPER_ADMIN). Les deux layouts
 * passent leurs propres `navGroups` et décident de l'affichage du sélecteur
 * d'établissement via `showEtablissement`.
 *
 * Les guards d'authentification (redirection vers `/login` ou `/saas/...`)
 * sont gérés par les layouts appelants AVANT de rendre cette coquille. La
 * coquille suppose donc que l'utilisateur est authentifié avec le bon rôle.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
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
  BarChart3,
  ArrowRight,
  MailOpen,
  GraduationCap,
  Clock,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
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
import { fetchCountSoumises } from "@/lib/api-pre-inscription";
import { fetchFileAttente } from "@/lib/api-caisse";
import { useToast } from "@/hooks/use-toast";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Footer } from "@/components/ds/footer";

/** Item de navigation pour la coquille — un `href` App Router (URL réelle). */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rôles autorisés. Si `undefined`, tous les rôles. */
  roles?: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Groupes de navigation pour le personnel d'établissement (DIRECTION,
 * CAISSIER, COMPTABLE, SECRETARIAT). DIRECTION gère le pilotage et la
 * configuration, mais n'accède PAS à la caisse ni à Mobile Money
 * (réservés au CAISSIER / COMPTABLE).
 */
export const STAFF_NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      {
        href: "/dashboard",
        label: "Tableau de bord",
        icon: LayoutDashboard,
        roles: ["CAISSIER", "COMPTABLE", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        href: "/eleves",
        label: "Élèves",
        icon: Users,
        roles: ["CAISSIER", "COMPTABLE", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        // Nouvelle inscription (wizard 4 étapes) : réservé au secrétariat
        // et à la direction (le caissier/comptable gèrent la caisse, pas les
        // inscriptions).
        href: "/inscription",
        label: "Nouvelle inscription",
        icon: UserPlus,
        roles: ["SECRETARIAT", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        // Caisse : réservée au CAISSIER et au COMPTABLE (encaissement,
        // clôture, reçus). La direction n'y accède pas.
        href: "/caisse",
        label: "Caisse",
        icon: Wallet,
        roles: ["CAISSIER", "COMPTABLE"],
      },
      {
        href: "/impayes",
        label: "Impayés & relances",
        icon: AlertTriangle,
        roles: ["CAISSIER", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "COMPTABLE"],
      },
      {
        href: "/rapports",
        label: "Rapports",
        icon: FileBarChart,
        roles: ["CAISSIER", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "COMPTABLE", "SECRETARIAT"],
      },
      {
        // Pré-inscriptions en ligne : demandes soumises par les parents via
        // le formulaire public /pre-inscription. Le secrétariat et la
        // direction valident ou rejettent chaque demande.
        href: "/pre-inscriptions",
        label: "Pré-inscriptions",
        icon: MailOpen,
        roles: ["SECRETARIAT", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        href: "/frais",
        label: "Frais & échéanciers",
        icon: Coins,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        href: "/annees",
        label: "Années scolaires",
        icon: CalendarDays,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        href: "/utilisateurs",
        label: "Utilisateurs",
        icon: UserCog,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        // Effectifs : tableau de bord de remplissage des classes (Phase 3,
        // Innovation 1). Réservé à la direction et aux directeurs (pilotage).
        href: "/effectifs",
        label: "Effectifs",
        icon: BarChart3,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        // Passage de classe en masse : opération de fin d'année (Phase 3,
        // Innovation 2). Réservé à la direction et aux directeurs.
        href: "/passage-masse",
        label: "Passage de classe",
        icon: ArrowRight,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
    ],
  },
  {
    // Pédagogie (module Enseignant — Phase A) : enseignants, matières et
    // affectations prof/matière/classe. Accessible à la direction, aux
    // directeurs (études / superviseur) et au secrétariat.
    label: "Pédagogie",
    items: [
      {
        href: "/enseignants",
        label: "Enseignants",
        icon: GraduationCap,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        href: "/matieres",
        label: "Matières",
        icon: BookOpen,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        href: "/affectations",
        label: "Affectations",
        icon: CalendarDays,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        // Écran de pointage temps réel (Phase B) : suivi des pointages
        // enseignants avec statut couleur (VERT / JAUNE / ROUGE / ORANGE) et
        // régularisation manuelle. Réservé à la direction et au secrétariat.
        href: "/pointage-ecran",
        label: "Pointage (temps réel)",
        icon: Clock,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        // Discipline (Phase B) : tableau de bord des tickets d'incident
        // disciplinaire et identification des élèves à risque. Réservé à la
        // direction, aux directeurs et au secrétariat.
        href: "/discipline",
        label: "Discipline",
        icon: ShieldAlert,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
      {
        // Paie enseignants (Phase C) : génération des bulletins mensuels,
        // validation/paiement et suivi des avances sur salaire. Réservé à la
        // direction et aux directeurs (études / superviseur).
        href: "/paie",
        label: "Paie enseignants",
        icon: Wallet,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"],
      },
      {
        // Emploi du temps (Phase A étendue) : planning hebdomadaire des
        // créneaux (Lundi → Samedi) et génération des sessions de pointage.
        // Accessible à la direction, aux directeurs et au secrétariat.
        href: "/emploi-du-temps",
        label: "Emploi du temps",
        icon: CalendarDays,
        roles: ["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR", "SECRETARIAT"],
      },
    ],
  },
  {
    label: "Modules avancés",
    items: [
      {
        // Comptabilité : réservé au COMPTABLE seul (séparation des responsabilités).
        href: "/comptabilite",
        label: "Comptabilité",
        icon: BookOpen,
        roles: ["COMPTABLE"],
      },
      {
        // Mobile Money : réservé au CAISSIER (guichet MoMo). La direction
        // n'y accède pas.
        href: "/mobile-money",
        label: "Mobile Money",
        icon: Smartphone,
        roles: ["CAISSIER"],
      },
      {
        href: "/parametres",
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
export const SAAS_NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage SaaS",
    items: [
      {
        href: "/saas/dashboard",
        label: "Tableau de bord SaaS",
        icon: LayoutDashboard,
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/saas/establishments",
        label: "Établissements",
        icon: Building2,
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/saas/audit",
        label: "Audit",
        icon: ScrollText,
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/saas/billing",
        label: "Facturation",
        icon: CreditCard,
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/saas/support",
        label: "Mode Support",
        icon: LifeBuoy,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
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

function isItemAllowed(item: NavItem, role: string | null): boolean {
  if (!item.roles) return true;
  if (!role) return false;
  return item.roles.includes(role as Role);
}

/** Détecte si un chemin correspond à un href de nav (exact ou préfixe). */
function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Pour éviter que `/dashboard` ne match `/dashboard-xyz`, on teste avec un slash.
  return pathname.startsWith(href + "/");
}

export interface DashboardShellProps {
  children: React.ReactNode;
  /** Groupes de navigation à afficher dans la sidebar. */
  navGroups: NavGroup[];
  /** Afficher le sélecteur d'établissement (multi-sites). Faux pour SaaS. */
  showEtablissement?: boolean;
  /** Cible de déconnexion (route de login à utiliser). */
  logoutRedirect?: string;
}

export function DashboardShell({
  children,
  navGroups,
  showEtablissement = true,
  logoutRedirect = "/login",
}: DashboardShellProps) {
  const { toast } = useToast();
  const pathname = usePathname();

  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const etablissement = useAuthStore((s) => s.etablissement);
  const setEtablissement = useAuthStore((s) => s.setEtablissement);
  const logout = useAuthStore((s) => s.logout);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [loadingEtabs, setLoadingEtabs] = useState(true);

  // Mode sidebar desktop : "expanded" (toujours visible), "collapsed" (masquée),
  // "hover" (s'ouvre au survol). Persisté en localStorage.
  type SidebarMode = "expanded" | "collapsed" | "hover";
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("expanded");
  const [hoverActive, setHoverActive] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("scolagest-sidebar-mode");
      if (saved === "expanded" || saved === "collapsed" || saved === "hover") {
        setSidebarMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const changeSidebarMode = useCallback((mode: SidebarMode) => {
    setSidebarMode(mode);
    try {
      localStorage.setItem("scolagest-sidebar-mode", mode);
    } catch {
      // ignore
    }
  }, []);

  // Dérivé : la sidebar est-elle visuellement affichée ?
  // - expanded : TOUJOURS visible (largeur w-64, labels + icônes)
  // - collapsed : TOUJOURS visible (largeur w-16, icônes seules, label au survol)
  // - hover : masquée par défaut, s'ouvre en grand (w-64) au survol du bord gauche
  const sidebarVisible =
    sidebarMode === "expanded" || sidebarMode === "collapsed" || (sidebarMode === "hover" && hoverActive);

  // Mode réduit : sidebar étroite (icônes uniquement, labels masqués)
  const sidebarCollapsed = sidebarMode === "collapsed";

  // Mode survol ouvert : sidebar ouverte en grand via survol (overlay sombre actif)
  const hoverOpen = sidebarMode === "hover" && hoverActive;

  // Charge la liste des établissements pour le sélecteur multi-sites.
  useEffect(() => {
    if (!showEtablissement) {
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
  }, [showEtablissement]);

  // Badge notifications : compte les pré-inscriptions en attente (polling 30s).
  // Uniquement pour les rôles qui ont accès au module pré-inscriptions.
  const hasPreInscriptionAccess = role === "SECRETARIAT" || role === "DIRECTION" ||
    role === "DIRECTEUR_ETUDES" || role === "DIRECTEUR_SUPERVISEUR";
  const { data: preInscriptionCount } = useQuery({
    queryKey: ["pre-inscriptions", "count-soumises"],
    queryFn: fetchCountSoumises,
    enabled: !!etablissement && hasPreInscriptionAccess,
    refetchInterval: 30_000, // polling toutes les 30s
    refetchOnWindowFocus: true,
  });
  const pendingCount = preInscriptionCount?.count ?? 0;

  // Badge « Caisse » : compte les élèves PRE_INSCRIT en attente de paiement
  // (polling 30s). Uniquement pour les rôles CAISSIER et COMPTABLE (les rôles
  // qui ont accès à la caisse). Même pattern que le badge pré-inscriptions.
  const hasCaisseAccess = role === "CAISSIER" || role === "COMPTABLE";
  const { data: fileAttente } = useQuery({
    queryKey: ["caisse", "file-attente", "list"] as const,
    queryFn: fetchFileAttente,
    enabled: !!etablissement && hasCaisseAccess,
    refetchInterval: 30_000, // polling toutes les 30s
    refetchOnWindowFocus: true,
  });
  const fileAttenteCount = fileAttente?.length ?? 0;

  // Filtrage RBAC des groupes de navigation.
  const visibleGroups = useMemo<NavGroup[]>(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((it) => isItemAllowed(it, role)),
      }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, role]);

  // Titre de la page dérivé du pathname (cherche le nav item actif).
  const pageTitle = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isActivePath(pathname, item.href)) return item.label;
      }
    }
    return "Tableau de bord";
  }, [pathname, navGroups]);

  // Ferme la sidebar mobile après un clic sur un lien.
  function handleNavClick() {
    setMobileOpen(false);
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
    // Navigation dure vers la page de login : garantit la redirection
    // (impossible à bloquer par l'état du routeur Next.js) et purge tout
    // l'état en mémoire (cache React Query, état des composants) — ce qui
    // est souhaitable lors d'une déconnexion. On évite aussi la course
    // critique entre router.push() et router.refresh().
    if (typeof window !== "undefined") {
      window.location.href = logoutRedirect;
    }
  }

  const etablissementSelectValue = etablissement?.id ?? "all";

  // Contenu de la sidebar (réutilisé pour desktop ET mobile Sheet)
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / marque */}
      <Link
        href={role === "SUPER_ADMIN" ? "/saas/dashboard" : "/dashboard"}
        onClick={handleNavClick}
        title={sidebarCollapsed ? "ScolaGest — Accueil" : undefined}
        className={cn(
          "flex h-16 shrink-0 items-center border-b transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-forest",
          sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <Image
          src="/logo.png"
          alt="ScolaGest"
          width={36}
          height={36}
          className="rounded-lg border-2 border-gold/40 shadow-sm"
        />
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold font-display leading-tight text-white">ScolaGest</p>
            <p className="truncate text-[10px] leading-tight text-emerald-100/80">
              Groupe Le Chandelier — Dabou
            </p>
          </div>
        )}
      </Link>

      {/* Sélecteur d'établissement (masqué en mode réduit — trop étroit) */}
      {showEtablissement && !sidebarCollapsed && (
        <div className="shrink-0 border-b p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-100/80">
            <Building2 className="size-3 text-emerald-100/80" aria-hidden="true" />
            Établissement actif
          </p>
          <Select
            value={etablissementSelectValue}
            onValueChange={handleEtablissementChange}
            disabled={loadingEtabs || etablissements.length === 0}
          >
            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
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
      {/* Mode réduit : icône établissement seule (tooltip natif) */}
      {showEtablissement && sidebarCollapsed && (
        <div className="flex shrink-0 justify-center border-b py-3" title="Établissement actif">
          <Building2 className="size-4 text-emerald-100/80" aria-hidden="true" />
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className={cn("space-y-5", sidebarCollapsed ? "p-2" : "p-3")}>
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">
                  {group.label}
                </p>
              )}
              {sidebarCollapsed && <div className="mb-1.5 h-px bg-white/10" aria-hidden="true" />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  // En mode réduit, badge repositionné en haut à droite de l'icône
                  const showPreBadge = item.href === "/pre-inscriptions" && pendingCount > 0;
                  const showCaisseBadge = item.href === "/caisse" && fileAttenteCount > 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={handleNavClick}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex w-full items-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-forest",
                          sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-2.5 py-2",
                          active
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-900/30"
                            : "text-emerald-100/80 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active
                              ? "text-white"
                              : "text-emerald-100/80 group-hover:text-amber-300",
                          )}
                          aria-hidden="true"
                        />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        {/* Badge notifications pré-inscriptions */}
                        {showPreBadge && !sidebarCollapsed && (
                          <span
                            className={cn(
                              "ml-auto flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                              active
                                ? "bg-white text-emerald-700"
                                : "bg-emerald-600 text-white",
                            )}
                          >
                            {pendingCount > 99 ? "99+" : pendingCount}
                          </span>
                        )}
                        {/* Badge file d'attente caisse (élèves PRE_INSCRIT) */}
                        {showCaisseBadge && !sidebarCollapsed && (
                          <span
                            className={cn(
                              "ml-auto flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                              active
                                ? "bg-white text-amber-700"
                                : "bg-amber-500 text-white",
                            )}
                          >
                            {fileAttenteCount > 99 ? "99+" : fileAttenteCount}
                          </span>
                        )}
                        {/* Badges en mode réduit : pastille en haut à droite */}
                        {showPreBadge && sidebarCollapsed && (
                          <span
                            className={cn(
                              "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold",
                              active ? "bg-white text-emerald-700" : "bg-emerald-500 text-white",
                            )}
                          >
                            {pendingCount > 99 ? "99+" : pendingCount}
                          </span>
                        )}
                        {showCaisseBadge && sidebarCollapsed && (
                          <span
                            className={cn(
                              "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold",
                              active ? "bg-white text-amber-700" : "bg-amber-500 text-white",
                            )}
                          >
                            {fileAttenteCount > 99 ? "99+" : fileAttenteCount}
                          </span>
                        )}
                        {active &&
                          !sidebarCollapsed &&
                          item.href !== "/pre-inscriptions" &&
                          item.href !== "/caisse" && (
                            <CheckCircle2 className="ml-auto size-3.5 text-amber-300" />
                          )}
                        {/* Indicateur actif en mode réduit : barre verticale à gauche */}
                        {active && sidebarCollapsed && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-amber-300" aria-hidden="true" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Contrôle sidebar — discret, desktop seulement.
          En mode réduit : icône toggle centrée uniquement (dropdown masqué,
          trop étroit). Le dropdown reste accessible en modes Étendu et Survol. */}
      <div className={cn(
        "hidden shrink-0 items-center border-t lg:flex",
        sidebarCollapsed ? "justify-center px-0 py-2" : "gap-1 px-3 py-2",
      )}>
        <button
          onClick={() => {
            // Cycle : expanded → collapsed → hover → expanded
            const next: SidebarMode =
              sidebarMode === "expanded" ? "collapsed" : sidebarMode === "collapsed" ? "hover" : "expanded";
            changeSidebarMode(next);
            if (next !== "expanded") setHoverActive(false);
          }}
          className="flex size-7 items-center justify-center rounded-md text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
          title={
            sidebarMode === "expanded"
              ? "Passer en mode Réduit (icônes seules)"
              : sidebarMode === "collapsed"
                ? "Passer en mode Survol (s'ouvre au survol)"
                : "Passer en mode Étendu (toujours visible)"
          }
          aria-label="Basculer le mode d'affichage de la sidebar"
        >
          {sidebarMode === "expanded" ? <PanelLeftClose className="size-4" aria-hidden="true" /> : <PanelLeftOpen className="size-4" aria-hidden="true" />}
        </button>
        {!sidebarCollapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
                title="Mode d'affichage de la sidebar"
                aria-label="Mode d'affichage de la sidebar"
              >
                {sidebarMode === "expanded" && "Étendu"}
                {sidebarMode === "collapsed" && "Réduit"}
                {sidebarMode === "hover" && "Survol"}
                <ChevronDown className="size-3" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Affichage de la sidebar
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { changeSidebarMode("expanded"); setHoverActive(false); }}
                className={cn("gap-2 text-xs", sidebarMode === "expanded" && "bg-white/10 text-amber-300")}
              >
                <PanelLeftOpen className="size-3.5" />
                <div className="flex flex-col">
                  <span className="font-medium">Étendu</span>
                  <span className="text-[10px] text-muted-foreground">Toujours visible, labels + icônes</span>
                </div>
                {sidebarMode === "expanded" && <CheckCircle2 className="ml-auto size-3.5 text-amber-300" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { changeSidebarMode("collapsed"); setHoverActive(false); }}
                className={cn("gap-2 text-xs", sidebarMode === "collapsed" && "bg-white/10 text-amber-300")}
              >
                <PanelLeftClose className="size-3.5" />
                <div className="flex flex-col">
                  <span className="font-medium">Réduit</span>
                  <span className="text-[10px] text-muted-foreground">Icônes seules, label au survol</span>
                </div>
                {sidebarMode === "collapsed" && <CheckCircle2 className="ml-auto size-3.5 text-amber-300" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { changeSidebarMode("hover"); setHoverActive(false); }}
                className={cn("gap-2 text-xs", sidebarMode === "hover" && "bg-white/10 text-amber-300")}
              >
                <PanelLeftOpen className="size-3.5 opacity-50" />
                <div className="flex flex-col">
                  <span className="font-medium">Survol</span>
                  <span className="text-[10px] text-muted-foreground">Masquée, s'ouvre au survol du bord</span>
                </div>
                {sidebarMode === "hover" && <CheckCircle2 className="ml-auto size-3.5 text-amber-300" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Bande kente décorative (masquée en mode réduit — trop étroite) */}
      {!sidebarCollapsed && <KentePattern variant="strip" position="bottom" />}
      {/* Carte utilisateur en bas */}
      <div className={cn("shrink-0 border-t border-white/10", sidebarCollapsed ? "p-2" : "p-3")}>
        <div
          className={cn(
            "flex items-center rounded-lg bg-white/5",
            sidebarCollapsed ? "justify-center p-1.5" : "gap-2.5 p-2",
          )}
          title={sidebarCollapsed ? (user ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() || user.email : "Utilisateur") : undefined}
        >
          <Avatar className="size-8 border-2 border-gold/40">
            <AvatarFallback className="bg-emerald-600 text-white text-[11px] font-semibold">
              {initials(user?.nom, user?.prenoms)}
            </AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium leading-tight text-white">
                {user
                  ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() || user.email
                  : "Utilisateur"}
              </p>
              <p className="truncate text-[10px] text-emerald-100/80 leading-tight">
                {roleLabel(role)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar desktop — 3 modes :
            - expanded : TOUJOURS visible, w-64 (labels + icônes)
            - collapsed : TOUJOURS visible, w-16 (icônes seules, label au survol)
            - hover : masquée par défaut (w-0), s'ouvre en grand (w-64) au survol
              du bord gauche, avec overlay sombre.
            z-20 pour rester au-dessus de l'overlay (z-10) en mode hover. */}
        <aside
          className={cn(
            "hidden bg-forest lg:flex lg:flex-col lg:overflow-y-auto transition-all duration-200 ease-in-out z-20",
            sidebarCollapsed
              ? "w-16 opacity-100"
              : sidebarVisible
                ? "w-64 opacity-100"
                : "w-0 opacity-0 overflow-hidden",
          )}
        >
          {sidebarContent}
        </aside>

        {/* Zone de survol (mode hover uniquement) — invisible mais détecte la
            souris sur le bord gauche pour ouvrir la sidebar.
            En mode collapsed, la sidebar est déjà visible (étroite), pas besoin. */}
        {sidebarMode === "hover" && !hoverActive && (
          <div
            className="absolute left-0 top-0 z-10 hidden h-full w-3 lg:block"
            onMouseEnter={() => setHoverActive(true)}
            aria-hidden
          />
        )}

        {/* Overlay sombre (mode hover ouvert uniquement) — clique/survole pour fermer */}
        {hoverOpen && (
          <div
            className="absolute inset-0 z-10 hidden bg-black/20 lg:block"
            onMouseEnter={() => setHoverActive(false)}
            aria-hidden
          />
        )}

        {/* Sidebar mobile (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 bg-forest p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation ScolaGest</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Colonne principale */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-forest/95 px-4 backdrop-blur-xl">
            {/* Bouton menu mobile (toujours visible <lg) */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 focus-visible:ring-amber-400/50 focus-visible:ring-offset-forest lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
            {/* Bouton ouvrir sidebar desktop — visible uniquement en mode Survol
                fermé (collapsed est déjà visible, expanded aussi). */}
            {sidebarMode === "hover" && !hoverActive && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden text-white hover:bg-white/10 focus-visible:ring-amber-400/50 focus-visible:ring-offset-forest lg:flex"
                onClick={() => setHoverActive(true)}
                aria-label="Ouvrir la sidebar"
              >
                <PanelLeftOpen className="size-5" aria-hidden="true" />
              </Button>
            )}

            <div className="flex flex-col">
              <h1 className="text-base font-semibold font-display leading-tight text-white">
                {pageTitle}
              </h1>
              <p className="hidden text-[11px] text-emerald-100/80 leading-tight sm:block">
                ScolaGest · Gestion &amp; Caisse Scolaire
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {/* Recherche (placeholder non fonctionnel) */}
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-emerald-100/80" aria-hidden="true" />
                <Input
                  placeholder="Rechercher un élève, un reçu…"
                  className="h-9 w-56 border-white/10 bg-white/5 pl-8 text-white placeholder:text-emerald-100/60 focus:border-amber-400/50 focus-visible:ring-amber-400/50 lg:w-72"
                  aria-label="Recherche"
                />
              </div>

              {/* Notifications (placeholder) */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative text-white hover:bg-white/10 focus-visible:ring-amber-400/50 focus-visible:ring-offset-forest"
              >
                <Bell className="size-5" aria-hidden="true" />
                <span className="absolute right-1.5 top-1.5 size-1.5 animate-pulse rounded-full bg-terracotta" aria-hidden="true" />
              </Button>

              <Separator orientation="vertical" className="h-6 bg-white/10" />

              {/* Menu utilisateur */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
                    aria-label="Menu utilisateur"
                  >
                    <Avatar className="size-8 border-2 border-gold/40">
                      <AvatarFallback className="bg-emerald-600 text-white text-[11px] font-semibold">
                        {initials(user?.nom, user?.prenoms)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden flex-col items-start leading-tight sm:flex">
                      <span className="text-xs font-medium text-white">
                        {user
                          ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() ||
                            user.email
                          : "Utilisateur"}
                      </span>
                      <span className="text-[10px] text-emerald-100/80">
                        {roleLabel(role)}
                      </span>
                    </span>
                    <ChevronDown className="hidden size-3.5 text-emerald-100/80 sm:block" aria-hidden="true" />
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
            <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</div>

            {/* Pied de page */}
            <KentePattern variant="strip" position="top" />
            <Footer variant="dark" />
          </main>
        </div>
      </div>
    </div>
  );
}
