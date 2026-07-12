"use client";

/**
 * ScolaGest — Fiche détail d'un élève (Phase 2)
 *
 * Affiche :
 *  - En-tête : photo (Avatar), nom complet, badges catégorie / statut,
 *    matricule MEN + identifiant interne, actions éditer / supprimer.
 *  - Carte "Identité" : date / lieu de naissance, sexe, établissement.
 *  - Carte "Tuteur" : nom, lien de parenté, téléphone (tel:), email, adresse.
 *  - Carte "Inscriptions" : tableau de l'historique (année, classe, statut,
 *    dérogation), bouton "Nouvelle inscription".
 *  - États : chargement (skeleton), erreur, non trouvé.
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm">
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const inscriptions = eleve.inscriptions ?? [];

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      {/* En-tête */}
      <GlassCard variant="adaptive" noHover>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-emerald-100 dark:border-emerald-900/40">
              {eleve.photo_url ? (
                <AvatarImage
                  src={eleve.photo_url}
                  alt={eleveFullName(eleve)}
                />
              ) : null}
              <AvatarFallback className="bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {initialsOf(eleve.nom, eleve.prenoms)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1.5">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {eleveFullName(eleve)}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">
                  ID interne : {eleve.identifiant_interne}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span>
                  Matricule MEN :{" "}
                  <span className="font-mono">
                    {eleve.matricule_ministere ?? "—"}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CategorieBadge categorie={eleve.categorie} />
                <StatutBadge statut={eleve.statut} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="size-4" />
              Modifier
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
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
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Identité */}
        <GlassCard variant="adaptive" noHover>
          <div className="mb-3 flex items-center gap-2">
            <UserCircle2 className="size-4 text-emerald-600" />
            <h3 className="font-display text-base font-semibold">Identité</h3>
          </div>
          <div className="space-y-3">
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
              icon={User}
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
        <GlassCard variant="adaptive" noHover>
          <div className="mb-3 flex items-center gap-2">
            <User className="size-4 text-emerald-600" />
            <h3 className="font-display text-base font-semibold">Tuteur</h3>
          </div>
          <div className="space-y-3">
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
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
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
                  <a
                    href={`tel:${eleve.tuteur.telephone}`}
                    className="flex items-center gap-3 rounded-md border border-transparent px-1 py-1 text-sm hover:border-border hover:bg-muted/40"
                  >
                    <Phone className="size-4 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        Téléphone
                      </p>
                      <p className="font-medium">
                        {eleve.tuteur.telephone}
                      </p>
                    </div>
                  </a>
                ) : null}
                {eleve.tuteur.telephone2 ? (
                  <a
                    href={`tel:${eleve.tuteur.telephone2}`}
                    className="flex items-center gap-3 rounded-md border border-transparent px-1 py-1 text-sm hover:border-border hover:bg-muted/40"
                  >
                    <Phone className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        Téléphone 2
                      </p>
                      <p className="font-medium">
                        {eleve.tuteur.telephone2}
                      </p>
                    </div>
                  </a>
                ) : null}
                {eleve.tuteur.email ? (
                  <a
                    href={`mailto:${eleve.tuteur.email}`}
                    className="flex items-center gap-3 rounded-md border border-transparent px-1 py-1 text-sm hover:border-border hover:bg-muted/40"
                  >
                    <Mail className="size-4 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="truncate font-medium">
                        {eleve.tuteur.email}
                      </p>
                    </div>
                  </a>
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
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <User className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Aucun tuteur renseigné.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  Affecter un tuteur
                </Button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Soldes & paiements (Phase 3) */}
      <EleveSoldeCard eleveId={eleveId} />

      {/* Inscriptions */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        <div className="flex items-center justify-between p-5 pb-3">
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
        <div>
          {inscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <FileText className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Aucune inscription enregistrée pour cet élève.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Année scolaire</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-4">Dérogation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inscriptions.map((insc) => (
                  <InscriptionRow key={insc.id} inscription={insc} />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
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
    <div className="flex items-center gap-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
      {badge}
    </div>
  );
}

function InscriptionRow({ inscription }: { inscription: Inscription }) {
  return (
    <TableRow>
      <TableCell className="pl-4">
        {inscription.annee_scolaire?.libelle ?? "—"}
      </TableCell>
      <TableCell className="font-medium">
        {inscription.classe?.libelle ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(inscription.date_inscription)}
      </TableCell>
      <TableCell>
        <StatutInscriptionBadge statut={inscription.statut} />
      </TableCell>
      <TableCell className="pr-4">
        {inscription.derogation_inscription ? (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
          >
            Dérogation
            {inscription.motif_derogation
              ? ` · ${inscription.motif_derogation}`
              : ""}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
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
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="size-4" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3.5 w-40" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
