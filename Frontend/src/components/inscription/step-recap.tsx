"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 4 : Récapitulatif (Refonte).
 *
 * Affiche un résumé lisible de toutes les données saisies (élève + tuteur +
 * scolarité) avant soumission. L'utilisateur vérifie puis valide via le
 * bouton « Valider l'inscription » du wizard principal.
 *
 * Refonte Forêt EdTech :
 *  - Section header numéroté (badge rond gradient emerald "4" + icône
 *    ClipboardCheck).
 *  - Bandeau de vérification : `GlassCard` subtile avec icône Info + message
 *    "Vérifiez les informations avant validation".
 *  - 3 cards de récap (Élève / Tuteur / Scolarité) en `GlassCard
 *    variant="adaptive"` (pas de Card shadcn basique). Header avec icône
 *    thématique dans badge rond (User emerald / Users amber / GraduationCap
 *    gold) + titre `font-display text-base font-semibold`. RecapRow : label
 *    muted + value medium avec `break-words leading-snug` pour éviter
 *    troncature. Cards `h-full` + grid `items-stretch` pour égaliser les
 *    hauteurs.
 *  - Badges : "Tuteur existant (fratrie)" → emerald (au lieu de blue),
 *    "Nouveau tuteur" → outline, "Dérogation 3 tranches" → amber.
 *  - Notes : card séparée en bas avec icône StickyNote.
 *  - Indicateur de soumission : si `isSubmitting`, overlay glass avec Loader2
 *    + message "Création de l'élève, du tuteur et de l'inscription en cours…".
 *
 * LOGIQUE MÉTIER INTACTE : hooks, query keys, DTOs, types, endpoints API,
 * signatures de fonctions.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardCheck,
  Fingerprint,
  GraduationCap,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  Tag,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  fetchClasses,
  fetchActiveAnnee,
  classesKeys,
  anneesKeys,
} from "@/lib/api-students";
import type { Classe, AnneeScolaire } from "@/lib/types";
import type {
  WorkflowEleve,
  WorkflowTuteur,
  WorkflowInscription,
} from "@/lib/api-inscription";

import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ds/glass-card";

interface StepRecapProps {
  eleve: WorkflowEleve;
  tuteur: WorkflowTuteur;
  inscription: WorkflowInscription;
  isSubmitting: boolean;
}

export function StepRecap({
  eleve,
  tuteur,
  inscription,
  isSubmitting,
}: StepRecapProps) {
  // Résoudre les libellés (classe, année) depuis les IDs
  const { data: classes } = useQuery<Classe[]>({
    queryKey: classesKeys.list(),
    queryFn: () => fetchClasses(),
  });
  const { data: activeAnnee } = useQuery<AnneeScolaire>({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
  });

  const classe = classes?.find((c) => c.id === inscription.classe_id);
  const annee = activeAnnee; // l'année active est la seule sélectionnable

  return (
    <div className="space-y-6">
      <SectionHeader
        num={4}
        icon={ClipboardCheck}
        title="Récapitulatif"
        subtitle="Vérifiez les informations ci-dessous avant de valider l'inscription."
      />

      {/* Bandeau de vérification */}
      <GlassCard variant="mobile" noHover className="flex items-center gap-3 p-3.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Info className="size-4" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">
          Vérifiez les informations ci-dessous avant validation. Vous pourrez
          encore revenir en arrière avec le bouton{" "}
          <span className="font-medium text-foreground">Précédent</span>.
        </p>
      </GlassCard>

      {/* Indicateur de soumission */}
      {isSubmitting && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50/80 px-4 py-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <Loader2 className="size-5 shrink-0 animate-spin text-emerald-600" aria-hidden="true" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Création de l&apos;élève, du tuteur et de l&apos;inscription en cours…
          </p>
        </div>
      )}

      {/* 3 cards de récap — grid items-stretch + h-full pour égaliser les hauteurs */}
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        {/* Élève */}
        <GlassCard variant="adaptive" noHover className="flex h-full flex-col p-5">
          <RecapHeader
            icon={User}
            tone="emerald"
            title="Élève"
          />
          <div className="mt-4 space-y-3">
            <RecapRow
              icon={User}
              label="Nom complet"
              value={`${eleve.prenoms ?? ""} ${eleve.nom}`.trim()}
            />
            <RecapRow
              icon={User}
              label="Sexe"
              value={
                eleve.sexe === "M"
                  ? "Masculin"
                  : eleve.sexe === "F"
                    ? "Féminin"
                    : "—"
              }
            />
            <RecapRow
              icon={CalendarDays}
              label="Date naiss."
              value={eleve.date_naissance ?? "—"}
            />
            <RecapRow
              icon={MapPin}
              label="Lieu naiss."
              value={eleve.lieu_naissance || "—"}
            />
            <RecapRow
              icon={Tag}
              label="Catégorie"
              value={eleve.categorie}
            />
            <RecapRow
              icon={Fingerprint}
              label="Matricule Min."
              value={eleve.matricule_ministere || "—"}
              mono
            />
          </div>
        </GlassCard>

        {/* Tuteur */}
        <GlassCard variant="adaptive" noHover className="flex h-full flex-col p-5">
          <RecapHeader
            icon={Users}
            tone="amber"
            title="Tuteur"
          />
          <div className="mt-4 space-y-3">
            {tuteur.tuteur_id ? (
              <>
                <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  Tuteur existant (fratrie)
                </Badge>
                <RecapRow
                  icon={Fingerprint}
                  label="ID tuteur"
                  value={tuteur.tuteur_id}
                  mono
                />
              </>
            ) : (
              <>
                <Badge variant="outline">Nouveau tuteur</Badge>
                <RecapRow
                  icon={User}
                  label="Nom"
                  value={`${tuteur.prenoms ?? ""} ${tuteur.nom ?? ""}`.trim()}
                />
                <RecapRow
                  icon={Phone}
                  label="Téléphone"
                  value={tuteur.telephone || "—"}
                />
                <RecapRow
                  icon={Tag}
                  label="Lien"
                  value={tuteur.lien_parente ?? "—"}
                />
                <RecapRow
                  icon={Tag}
                  label="Profession"
                  value={tuteur.profession || "—"}
                />
                <RecapRow
                  icon={Mail}
                  label="Email"
                  value={tuteur.email || "—"}
                />
              </>
            )}
          </div>
        </GlassCard>

        {/* Scolarité */}
        <GlassCard variant="adaptive" noHover className="flex h-full flex-col p-5">
          <RecapHeader
            icon={GraduationCap}
            tone="gold"
            title="Scolarité"
          />
          <div className="mt-4 space-y-3">
            <RecapRow
              icon={GraduationCap}
              label="Classe"
              value={classe?.libelle ?? "—"}
            />
            <RecapRow
              icon={CalendarDays}
              label="Année"
              value={annee?.libelle ?? "—"}
            />
            <RecapRow
              icon={Tag}
              label="Statut"
              value={inscription.statut ?? "INSCRIT"}
            />
            {inscription.derogation_inscription && (
              <>
                <Badge className="border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Dérogation 3 tranches
                </Badge>
                <RecapRow
                  icon={StickyNote}
                  label="Motif"
                  value={inscription.motif_derogation || "—"}
                />
              </>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Notes */}
      {inscription.notes && (
        <GlassCard variant="mobile" noHover className="p-4">
          <RecapHeader
            icon={StickyNote}
            tone="emerald"
            title="Notes"
          />
          <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">
            {inscription.notes}
          </p>
        </GlassCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

const TONE_BADGES = {
  emerald: {
    bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  amber: {
    bg: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  gold: {
    bg: "bg-gold/20 text-gold-dark dark:text-gold-light",
  },
} as const;

function RecapHeader({
  icon: Icon,
  tone,
  title,
}: {
  icon: LucideIcon;
  tone: "emerald" | "amber" | "gold";
  title: string;
}) {
  const t = TONE_BADGES[tone];
  return (
    <div className="flex items-center gap-2.5">
      <div className={["flex size-9 shrink-0 items-center justify-center rounded-full", t.bg].join(" ")}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="font-display text-base font-semibold leading-tight text-foreground">
        {title}
      </h3>
    </div>
  );
}

function RecapRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
        <Icon className="size-3.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={[
            "break-words text-sm font-medium leading-snug text-foreground",
            mono ? "font-mono" : "",
          ].join(" ")}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  num,
  icon: Icon,
  title,
  subtitle,
}: {
  num: number;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-sm">
        {num}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-emerald-600" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold leading-tight text-forest">
            {title}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
