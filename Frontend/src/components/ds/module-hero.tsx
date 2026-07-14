import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KentePattern } from "./kente-pattern";

export interface ModuleHeroProps {
  /** Icône Lucide du module (ex: Wallet pour caisse, Users pour élèves). */
  icon: LucideIcon;
  /** Titre principal (ex: "Encaissements", "Élèves"). */
  title: string;
  /** Sous-titre descriptif (ex: "Guichet de paiement multi-mode"). */
  subtitle?: string;
  /** Badge/pill optionnel (ex: "Phase 5", "Beta"). */
  badge?: string;
  /** Icône du badge optionnel (ex: Sparkles). */
  badgeIcon?: LucideIcon;
  /** Actions optionnelles à droite (boutons). */
  actions?: React.ReactNode;
  /** Classe complémentaire sur la racine `<header>`. */
  className?: string;
}

/**
 * `ModuleHero` — header premium "Forêt EdTech" réutilisable pour les modules
 * du dashboard ScolaGest.
 *
 * Réplique fidèle du header « wahou » de la page publique
 * `/pre-inscription/suivi` (cf. `app/pre-inscription/suivi/page.tsx` l. 343-429),
 * adapté au contexte dashboard.
 *
 * **Structure** :
 * 1. Strip kente top (motif africain riche sur fond emerald, via `<KentePattern>`)
 * 2. Bandeau gradient emerald→amber + glassmorphism (`backdrop-blur` + variantes
 *    `supports-[backdrop-filter]` pour fallback opacity)
 * 3. Badge icône dégradé (variante module : `bg-gradient-to-br from-emerald-600
 *    to-amber-500 text-white` au lieu du logo blanc de la page suivi publique)
 *    + étoile ★ gold en superposition (badge premium, identique à la page suivi)
 * 4. Titre `font-display` blanc + sous-titre `text-emerald-50/90`
 * 5. Pill/badge optionnel + emplacement `actions` à droite
 *
 * **Différences assumées avec la page suivi publique** :
 * - `max-w-7xl` au lieu de `max-w-5xl` (le dashboard est plus large que la
 *   page publique centrée)
 * - Badge icône en dégradé emerald→amber (au lieu du logo blanc `Image`) pour
 *   signaler visuellement qu'on est dans un module interne, pas une page
 *   publique. L'étoile ★ gold reste **strictement identique** (size-4,
 *   `bg-gold`, `text-emerald-900`, `ring-2 ring-white`, position
 *   `-bottom-1 -right-1`).
 *
 * **Comportement sticky** : le `<header>` est `sticky top-0 z-30` pour rester
 * visible au scroll, **à l'intérieur de la zone de contenu du dashboard** (la
 * sidebar reste à gauche, ce header se colle en haut du contenu scrollable,
 * pas en sticky full-screen viewport).
 *
 * **Accessibilité** :
 * - Icône du module et étoile ★ sont `aria-hidden="true"` (décoratives).
 * - Le `badge` est exposé via `title` (infobulle) sur le pill pour SR.
 * - Aucune animation Framer Motion ou CSS lourde → respecte
 *   `prefers-reduced-motion` par construction (rendu purement statique,
 *   seul le `backdrop-blur` natif du bandeau subsiste).
 *
 * **Pas de `"use client"`** : composant pur de rendu, utilisable aussi bien
 * dans une Server Component qu'une Client Component. Les éventuelles actions
 * interactives passées via la prop `actions` (ex: `<Button onClick>`) sont
 * des Client Components shadcn déjà marqués `"use client"` — le pont est
 * automatique côté Next.js App Router.
 *
 * @example
 * ```tsx
 * import { Wallet, Sparkles } from "lucide-react";
 * import { ModuleHero } from "@/components/ds/module-hero";
 * import { Button } from "@/components/ui/button";
 *
 * export default function CaissePage() {
 *   return (
 *     <>
 *       <ModuleHero
 *         icon={Wallet}
 *         title="Encaissements"
 *         subtitle="Guichet de paiement multi-mode"
 *         badge="Phase 5"
 *         badgeIcon={Sparkles}
 *         actions={
 *           <Button size="sm" variant="outline">Nouvel encaissement</Button>
 *         }
 *       />
 *       <main className="p-4 md:p-6">{/* contenu du module *\/}</main>
 *     </>
 *   );
 * }
 * ```
 */
export function ModuleHero({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeIcon: BadgeIcon,
  actions,
  className,
}: ModuleHeroProps) {
  return (
    <header className={cn("sticky top-0 z-30 shrink-0", className)}>
      {/* Strip kente top — motif africain riche sur fond emerald */}
      <KentePattern variant="strip" position="top" />

      {/* Bandeau gradient emerald→amber + glassmorphism (avec fallback opacity) */}
      <div className="relative border-b border-emerald-200/60 bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500/90 backdrop-blur supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-emerald-700/95 supports-[backdrop-filter]:via-emerald-600/95 supports-[backdrop-filter]:to-amber-500/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          {/* Icône du module (badge dégradé) + étoile gold premium */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-amber-500 p-2 text-white shadow-md shadow-emerald-900/30 ring-1 ring-gold/40">
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-emerald-900 ring-2 ring-white"
              >
                ★
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-tight text-white">
                {title}
              </p>
              {subtitle ? (
                <p className="break-words text-[11px] leading-tight text-emerald-50/90">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {/* Pill/badge optionnel + actions à droite */}
          <div className="ml-auto flex items-center gap-2">
            {badge ? (
              <span
                className="hidden items-center gap-1 rounded-full border border-white/40 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm sm:inline-flex"
                title={badge}
              >
                {BadgeIcon ? (
                  <BadgeIcon className="size-3" aria-hidden="true" />
                ) : null}
                {badge}
              </span>
            ) : null}
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}

export default ModuleHero;
