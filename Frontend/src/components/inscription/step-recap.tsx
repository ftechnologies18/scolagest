"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 4 : Récapitulatif.
 *
 * Affiche un résumé lisible de toutes les données saisies (élève + tuteur +
 * scolarité) avant soumission. L'utilisateur vérifie puis valide via le
 * bouton « Valider l'inscription » du wizard principal.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Users, GraduationCap, Loader2 } from "lucide-react";

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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div>
        <h2 className="text-lg font-semibold">Récapitulatif</h2>
        <p className="text-sm text-muted-foreground">
          Vérifiez les informations ci-dessous avant de valider l&apos;inscription.
          {isSubmitting && " Inscription en cours…"}
        </p>
      </div>

      {isSubmitting && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <Loader2 className="size-5 animate-spin text-emerald-600" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Création de l&apos;élève, du tuteur et de l&apos;inscription en cours…
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Élève */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="size-4 text-emerald-600" />
              Élève
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <RecapRow label="Nom" value={`${eleve.prenoms ?? ""} ${eleve.nom}`.trim()} />
            <RecapRow
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
              label="Date naiss."
              value={eleve.date_naissance ?? "—"}
            />
            <RecapRow label="Lieu naiss." value={eleve.lieu_naissance || "—"} />
            <RecapRow label="Catégorie" value={eleve.categorie} />
            <RecapRow
              label="Matricule Min."
              value={eleve.matricule_ministere || "—"}
              mono
            />
          </CardContent>
        </Card>

        {/* Tuteur */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-blue-600" />
              Tuteur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tuteur.tuteur_id ? (
              <>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                  Tuteur existant (fratrie)
                </Badge>
                <RecapRow label="ID tuteur" value={tuteur.tuteur_id} mono />
              </>
            ) : (
              <>
                <Badge variant="outline">Nouveau tuteur</Badge>
                <RecapRow
                  label="Nom"
                  value={`${tuteur.prenoms ?? ""} ${tuteur.nom ?? ""}`.trim()}
                />
                <RecapRow label="Téléphone" value={tuteur.telephone || "—"} />
                <RecapRow label="Lien" value={tuteur.lien_parente ?? "—"} />
                <RecapRow label="Profession" value={tuteur.profession || "—"} />
                <RecapRow label="Email" value={tuteur.email || "—"} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Scolarité */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <GraduationCap className="size-4 text-amber-600" />
              Scolarité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <RecapRow label="Classe" value={classe?.libelle ?? "—"} />
            <RecapRow label="Année" value={annee?.libelle ?? "—"} />
            <RecapRow label="Statut" value={inscription.statut ?? "INSCRIT"} />
            {inscription.derogation_inscription && (
              <>
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  Dérogation 3 tranches
                </Badge>
                <RecapRow
                  label="Motif"
                  value={inscription.motif_derogation || "—"}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {inscription.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{inscription.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecapRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-sm font-medium ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
