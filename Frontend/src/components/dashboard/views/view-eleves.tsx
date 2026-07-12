"use client";

/**
 * ScolaGest — Vue "Élèves" (Phase 2 — Refonte Forêt EdTech)
 *
 * Sous-routeur client-side géré par un état local :
 *   - "list"   : liste filtrée des élèves
 *   - "detail" : fiche détaillée d'un élève
 *   - "form"   : création ou édition d'un élève
 *
 * Le `DashboardLayout` render `<ElevesView />` lorsque la nav "Élèves" est
 * active. Le nom d'export par défaut est conservé pour ne pas casser
 * l'import dans `dashboard-layout.tsx`.
 *
 * Refonte Forêt EdTech :
 *  - Bande kente en tête de vue (déjà en place, conservée).
 *  - Breadcrumb contextuel : "Élèves" → "Détail" / "Nouvel élève" /
 *    "Modifier", avec icônes Lucide et_separator chevrons.
 *  - Transition Framer Motion entre sous-vues (AnimatePresence + fade/slide
 *    y:16, durée 0.4s, ease custom). Respecte prefers-reduced-motion
 *    via le hook dédié.
 *
 * LOGIQUE MÉTIER INTACTE : sous-vues "list" / "detail" / "form", navigation
 * goToList / goToDetail / goToCreate / goToEdit, scroll to top sur changement
 * de vue.
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Users, UserCircle2, UserPlus, Pencil } from "lucide-react";

import { ElevesList } from "@/components/eleves/eleves-list";
import { EleveDetail } from "@/components/eleves/eleve-detail";
import { EleveForm } from "@/components/eleves/eleve-form";
import { KentePattern } from "@/components/ds/kente-pattern";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

type SubView = "list" | "detail" | "form";

interface BreadcrumbItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export default function ElevesView() {
  const [view, setView] = React.useState<SubView>("list");
  const [selectedEleveId, setSelectedEleveId] = React.useState<string | null>(
    null,
  );
  const prefersReducedMotion = usePrefersReducedMotion();

  // ─── Handlers de navigation ──────────────────────────────────────────────
  function goToList() {
    setView("list");
    setSelectedEleveId(null);
  }

  function goToDetail(id: string) {
    setSelectedEleveId(id);
    setView("detail");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToCreate() {
    setSelectedEleveId(null);
    setView("form");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToEdit(id: string) {
    setSelectedEleveId(id);
    setView("form");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ─── Breadcrumb contextuel ────────────────────────────────────────────────
  const breadcrumb: BreadcrumbItem[] = React.useMemo(() => {
    if (view === "list") {
      return [{ icon: Users, label: "Élèves" }];
    }
    if (view === "detail") {
      return [
        { icon: Users, label: "Élèves" },
        { icon: UserCircle2, label: "Détail" },
      ];
    }
    // view === "form"
    return [
      { icon: Users, label: "Élèves" },
      selectedEleveId
        ? { icon: Pencil, label: "Modifier" }
        : { icon: UserPlus, label: "Nouvel élève" },
    ];
  }, [view, selectedEleveId]);

  // ─── Variants d'animation ─────────────────────────────────────────────────
  const motionProps = prefersReducedMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  // ─── Render ──────────────────────────────────────────────────────────────
  // Bande kente Forêt EdTech en tête de vue (commune aux 3 sous-vues).
  let content: React.ReactNode;
  if (view === "detail" && selectedEleveId) {
    content = (
      <EleveDetail
        eleveId={selectedEleveId}
        onBack={goToList}
        onEdit={() => goToEdit(selectedEleveId)}
      />
    );
  } else if (view === "form") {
    content = (
      <EleveForm
        eleveId={selectedEleveId ?? undefined}
        onSaved={(id) => goToDetail(id)}
        onCancel={
          selectedEleveId ? () => goToDetail(selectedEleveId) : goToList
        }
      />
    );
  } else {
    // Vue par défaut : liste
    content = (
      <ElevesList
        onCreate={goToCreate}
        onSelect={(id) => goToDetail(id)}
        onEdit={(id) => goToEdit(id)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <KentePattern variant="strip" position="top" />

      {/* Breadcrumb contextuel */}
      <nav
        aria-label="Fil d'Ariane"
        className="flex flex-wrap items-center gap-1 px-1 text-xs text-muted-foreground sm:text-sm"
      >
        {breadcrumb.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === breadcrumb.length - 1;
          return (
            <React.Fragment key={`${item.label}-${idx}`}>
              <span
                className={
                  isLast
                    ? "flex items-center gap-1.5 font-medium text-foreground"
                    : "flex items-center gap-1.5"
                }
              >
                <Icon className="size-3.5" />
                {item.label}
              </span>
              {!isLast ? (
                <ChevronRight
                  className="size-3.5 text-muted-foreground/60"
                  aria-hidden="true"
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Contenu animé */}
      <AnimatePresence mode="wait">
        <motion.div key={view} {...motionProps}>
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
