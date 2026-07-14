"use client";

/**
 * ScolaGest — Fiche détail d'un élève (Phase 2 — Refonte Forêt EdTech)
 *
 * Affiche :
 *  - En-tête premium : GlassCard desktop + premiumBorder (effet carte
 *    d'identité) avec photo avatar size-20 ring gold, nom font-display, ID
 *    interne + Matricule MEN mono, badges catégorie/statut/sexe, actions
 *    Modifier (outline) / Supprimer (destructive outline).
 *  - Carte "Identité" (icône UserCircle2) : date / lieu de naissance, sexe,
 *    établissement. InfoRow avec icône en badge arrondi emerald/10 + hover bg.
 *  - Carte "Tuteur" (icône Users) : nom, lien de parenté, téléphone (tel:),
 *    email, adresse. Empty state avec KentePattern bg + CTA "Affecter un
 *    tuteur" en variant success.
 *  - Carte "Soldes & paiements" (EleveSoldeCard — refactor dans son fichier).
 *  - Carte "Historique des inscriptions" :
 *      - ProgressCircle : taux d'inscriptions valides (INSCRIT + REINSCRIT).
 *      - Timeline verticale : année en gras, classe, badge statut à droite.
 *  - États : chargement (skeleton), erreur, non trouvé.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query, query keys, fetchEleve,
 * deleteEleve, invalidations, types Inscription / StatutInscription.
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  User,
  UserCircle2,
  AlertCircle,
  FileText,
  Plus,
  Users,
  Mars,
  Venus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  fetchEleve,
  deleteEleve,
  elevesKeys,
  inscriptionsKeys,
} from "@/lib/api-students";
import type {
  Eleve,
  Inscription,
  LienParente,
  StatutInscription,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { ProgressCircle } from "@/components/ds/progress-circle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  CategorieBadge,
  StatutBadge,
  initialsOf,
  eleveFullName,
} from "@/components/eleves/eleves-list";
import { InscriptionDialog } from "@/components/eleves/inscription-dialog";
import { EleveSoldeCard } from "@/components/eleves/eleve-solde-card";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LIEN_PARENTE_LABEL: Record<LienParente, string> = {
  PERE: "Père",
  MERE: "Mère",
  TUTEUR_LEGAL: "Tuteur légal",
  AUTRE: "Autre",
  "": "—",
};

const STATUT_INSCRIPTION_LABEL: Record<StatutInscription, string> = {
  PRE_INSCRIT: "Pré-inscrit (paiement requis)",
  INSCRIT: "Inscrit",
  REINSCRIT: "Réinscrit",
  TRANSFERE: "Transféré",
  ABANDON: "Abandon",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatSexe(sexe: string): string {
  if (sexe === "M") return "Masculin";
  if (sexe === "F") return "Féminin";
  return "—";
}

function StatutInscriptionBadge({ statut }: { statut: StatutInscription }) {
  const cls: Record<StatutInscription, string> = {
    PRE_INSCRIT:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    INSCRIT:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    REINSCRIT:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
    TRANSFERE:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    ABANDON:
      "border-muted-foreground/20 bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", cls[statut])}>
      {STATUT_INSCRIPTION_LABEL[statut]}
    </Badge>
  );
}

/** Calcule le % d'inscriptions "valides" (INSCRIT + REINSCRIT) sur le total. */
function computeValidRatio(inscriptions: Inscription[]): number {
  if (inscriptions.length === 0) return 0;
  const valid = inscriptions.filter(
    (i) => i.statut === "INSCRIT" || i.statut === "REINSCRIT",
  ).length;
  return Math.round((valid / inscriptions.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export interface EleveDetailProps {
  eleveId: string;
  onBack: () => void;
  onEdit: () => void;
}

export function EleveDetail({ eleveId, onBack, onEdit }: EleveDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inscriptionOpen, setInscriptionOpen] = React.useState(false);

  const {
    data: eleve,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: elevesKeys.detail(eleveId),
    queryFn: () => fetchEleve(eleveId),
    enabled: !!eleveId,
  });

  async function handleDelete() {
    try {
      await deleteEleve(eleveId);
      await queryClient.invalidateQueries({ queryKey: elevesKeys.lists() });
      toast({
        title: "Élève supprimé",
        description: "La fiche a été définitivement supprimée.",
      });
      onBack();
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer cet élève.",
        variant: "destructive",
      });
    }
  }

  // ─── États ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <DetailSkeleton onBack={onBack} />;
  }

  if (isError || !eleve) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onBack} />
        <GlassCard variant="adaptive" noHover>
          <div className="flex items-center gap-3 py-10 text-sm">
            <AlertCircle className="size-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                Élève introuvable
              </p>
              <p className="text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "La fiche demandée n'existe pas ou n'est pas accessible."}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  const inscriptions = eleve.inscriptions ?? [];
  const validRatio = computeValidRatio(inscriptions);

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      {/* En-tête premium — carte d'identité avec bordure gold */}
      <GlassCard variant="desktop" premiumBorder noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-20 border-2 border-gold ring-2 ring-gold/30 shadow-lg dark:border-gold-dark">
              {eleve.photo_url ? (
                <AvatarImage
                  src={eleve.photo_url}
                  alt={eleveFullName(eleve)}
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-xl font-bold text-white shadow-inner dark:from-emerald-700 dark:to-emerald-900 dark:text-emerald-50">
                {initialsOf(eleve.nom, eleve.prenoms)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <h2 className="font-display text-xl font-semibold tracking-tight text-forest sm:text-2xl">
                {eleveFullName(eleve)}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                <span className="font-mono">
                  ID interne :{" "}
                  <span className="font-semibold text-foreground">
                    {eleve.identifiant_interne}
                  </span>
                </span>
                <Separator orientation="vertical" className="hidden h-4 sm:block" />
                <span>
                  Matricule MEN :{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {eleve.matricule_ministere ?? "—"}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CategorieBadge categorie={eleve.categorie} />
                <StatutBadge statut={eleve.statut} />
                {eleve.sexe === "M" ? (
                  <Badge
                    variant="outline"
                    className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    <Mars className="mr-1 size-3" />
                    Masculin
                  </Badge>
                ) : eleve.sexe === "F" ? (
                  <Badge
                    variant="outline"
                    className="border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900/50 dark:bg-pink-950/40 dark:text-pink-300"
                  >
                    <Venus className="mr-1 size-3" />
                    Féminin
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="size-4" />
              Modifier
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/5"
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cet élève ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. La fiche de{" "}
                    <strong>{eleveFullName(eleve)}</strong> ainsi que son
                    historique d'inscriptions seront supprimés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Supprimer définitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {/* Grille de cartes */}
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {/* Identité */}
        <GlassCard variant="adaptive" noHover className="h-full">
          <SectionHeader
            icon={UserCircle2}
            title="Identité"
            subtitle="Informations d'état civil"
          />
          <div className="space-y-2">
            <InfoRow
              icon={Calendar}
              label="Date de naissance"
              value={formatDate(eleve.date_naissance)}
            />
            <InfoRow
              icon={MapPin}
              label="Lieu de naissance"
              value={eleve.lieu_naissance || "—"}
            />
            <InfoRow
              icon={eleve.sexe === "F" ? Venus : Mars}
              label="Sexe"
              value={formatSexe(eleve.sexe)}
            />
            <InfoRow
              icon={GraduationCap}
              label="Établissement"
              value={eleve.etablissement?.nom ?? "—"}
            />
          </div>
        </GlassCard>

        {/* Tuteur */}
        <GlassCard variant="adaptive" noHover className="h-full">
          <SectionHeader
            icon={Users}
            title="Tuteur"
            subtitle="Contact & lien de parenté"
          />
          <div className="space-y-2">
            {eleve.tuteur ? (
              <>
                <InfoRow
                  icon={User}
                  label="Nom complet"
                  value={`${eleve.tuteur.prenoms ?? ""} ${
                    eleve.tuteur.nom ?? ""
                  }`.trim()}
                  badge={
                    eleve.tuteur.lien_parente ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        {LIEN_PARENTE_LABEL[eleve.tuteur.lien_parente]}
                      </Badge>
                    ) : null
                  }
                />
                {eleve.tuteur.profession ? (
                  <InfoRow
                    icon={User}
                    label="Profession"
                    value={eleve.tuteur.profession}
                  />
                ) : null}
                {eleve.tuteur.telephone ? (
                  <ContactRow
                    href={`tel:${eleve.tuteur.telephone}`}
                    icon={Phone}
                    label="Téléphone"
                    value={eleve.tuteur.telephone}
                  />
                ) : null}
                {eleve.tuteur.telephone2 ? (
                  <ContactRow
                    href={`tel:${eleve.tuteur.telephone2}`}
                    icon={Phone}
                    label="Téléphone 2"
                    value={eleve.tuteur.telephone2}
                    muted
                  />
                ) : null}
                {eleve.tuteur.email ? (
                  <ContactRow
                    href={`mailto:${eleve.tuteur.email}`}
                    icon={Mail}
                    label="Email"
                    value={eleve.tuteur.email}
                  />
                ) : null}
                {eleve.tuteur.adresse ? (
                  <InfoRow
                    icon={MapPin}
                    label="Adresse"
                    value={eleve.tuteur.adresse}
                  />
                ) : null}
                <p className="pt-2 text-xs text-muted-foreground">
                  Pour changer de tuteur, modifiez la fiche élève.
                </p>
              </>
            ) : (
              <EmptyTuteur onEdit={onEdit} />
            )}
          </div>
        </GlassCard>
      </div>

      {/* Soldes & paiements (Phase 3) */}
      <EleveSoldeCard eleveId={eleveId} />

      {/* Inscriptions */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden">
        <div className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-emerald-600" />
            <h3 className="font-display text-base font-semibold">
              Historique des inscriptions
            </h3>
          </div>
          <Button
            onClick={() => setInscriptionOpen(true)}
            variant="success"
            size="sm"
          >
            <Plus className="size-4" />
            Nouvelle inscription
          </Button>
        </div>

        {inscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Aucune inscription enregistrée pour cet élève.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 pt-2 lg:grid-cols-[auto_1fr]">
            {/* ProgressCircle : taux d'inscriptions valides */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <ProgressCircle value={validRatio} size={110} strokeWidth={9} />
              <div className="text-center">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Inscriptions valides
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {inscriptions.length} au total
                </p>
              </div>
            </div>

            {/* Timeline verticale */}
            <ol className="relative space-y-3 border-l-2 border-emerald-100 pl-4 dark:border-emerald-900/40">
              {inscriptions.map((insc) => (
                <InscriptionTimelineItem
                  key={insc.id}
                  inscription={insc}
                />
              ))}
            </ol>
          </div>
        )}
      </GlassCard>

      {/* Dialog nouvelle inscription */}
      <InscriptionDialog
        open={inscriptionOpen}
        onOpenChange={setInscriptionOpen}
        eleveId={eleveId}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="-ml-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Retour à la liste
    </Button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold leading-tight">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium leading-snug">{value}</p>
      </div>
      {badge}
    </div>
  );
}

function ContactRow({
  href,
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
    >
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
          muted
            ? "bg-muted text-muted-foreground"
            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium leading-snug">{value}</p>
      </div>
    </a>
  );
}

function EmptyTuteur({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-dashed border-emerald-200 px-4 py-8 text-center dark:border-emerald-900/40">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center gap-2">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Users className="size-6" />
        </div>
        <p className="text-sm font-medium">Aucun tuteur renseigné</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Affectez un tuteur légal pour permettre le suivi et les relances.
        </p>
        <Button
          variant="success"
          size="sm"
          onClick={onEdit}
          className="mt-1"
        >
          <User className="size-3.5" />
          Affecter un tuteur
        </Button>
      </div>
    </div>
  );
}

function InscriptionTimelineItem({
  inscription,
}: {
  inscription: Inscription;
}) {
  return (
    <li className="relative">
      {/* Point sur la timeline */}
      <span
        className="absolute -left-[22px] top-1.5 flex size-3 items-center justify-center rounded-full border-2 border-emerald-600 bg-white dark:bg-emerald-950"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5 rounded-lg border border-muted bg-muted/20 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/20 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="font-display text-sm font-semibold">
            {inscription.annee_scolaire?.libelle ?? "—"}
          </p>
          <p className="text-sm text-foreground">
            {inscription.classe?.libelle ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Inscrit le {formatDate(inscription.date_inscription)}
          </p>
          {inscription.derogation_inscription ? (
            <Badge
              variant="outline"
              className="mt-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
            >
              Dérogation
              {inscription.motif_derogation
                ? ` · ${inscription.motif_derogation}`
                : ""}
            </Badge>
          ) : null}
        </div>
        <div className="shrink-0">
          <StatutInscriptionBadge statut={inscription.statut} />
        </div>
      </div>
    </li>
  );
}

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <GlassCard variant="adaptive" noHover>
        <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-72" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </GlassCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <GlassCard key={i} variant="adaptive" noHover className="overflow-hidden p-0">
            <div className="px-5 py-4">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-3 p-5 pt-0">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="size-4" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3.5 w-40" />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        <div className="px-5 py-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="space-y-2 p-5 pt-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
