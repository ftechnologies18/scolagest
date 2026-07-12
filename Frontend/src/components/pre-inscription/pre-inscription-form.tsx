"use client";

/**
 * ScolaGest — Formulaire PUBLIC de pré-inscription en ligne (Phase 3, Innovation 3).
 *
 * Accessible sans authentification sur la route `/pre-inscription`. Le parent
 * y saisit l'identité de son enfant, ses propres coordonnées et la classe
 * souhaitée. La soumission appelle `submitPreInscription` (route publique,
 * `skipAuth: true`).
 *
 * Sections :
 *  - Sélecteur d'établissement (fetchEtablissements sans auth, liste des actifs)
 *  - Élève : nom, prénoms, date/lieu naissance, sexe, catégorie
 *    (catégorie masquée si l'établissement n'applique pas la distinction)
 *  - Tuteur : nom, prénoms, téléphone, email, lien de parenté
 *    + Détection fratrie : debounce 500ms sur le téléphone → recherche
 *      `searchTuteurByPhone` (route publique) → bannière emerald + bouton
 *      « Pré-remplir mes informations » si le tuteur est déjà connu.
 *  - Classe souhaitée : cascade Cycle → Niveau → Classe
 *  - Informations complémentaires (optionnel) : ancien établissement
 *    (transfert), allergies, notes santé
 *  - Notes : message optionnel au secrétariat
 *
 * Écran de succès : carte avec token de suivi + lien vers la page de suivi
 * `/pre-inscription/suivi?token=XXX` + bouton « Copier le lien ».
 *
 * Design moderne : dégradé emerald, glassmorphism léger, responsive.
 *
 * IMPORTANT : ce formulaire ne doit PAS utiliser useAuthStore (pas de login
 * requis) ni RoleGuard.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  GraduationCap,
  HeartPulse,
  Loader2,
  Mail,
  Phone,
  School,
  Send,
  Sparkles,
  User,
  Users,
  Wand2,
} from "lucide-react";

import {
  classesKeys,
  cyclesKeys,
} from "@/lib/api-students";
import { apiGet, ApiError } from "@/lib/api-client";
import type { Classe, Cycle } from "@/lib/types";
import type { Etablissement } from "@/lib/auth-store";
import {
  searchTuteurByPhone,
  submitPreInscription,
  type CategorieEleve,
  type LienParente,
  type PreInscriptionDTO,
  type SexeEleve,
  type SubmitResult,
  type TuteurFratrieResult,
} from "@/lib/api-pre-inscription";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de rendu
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function PreInscriptionForm() {
  const { toast } = useToast();

  // ─── Établissements (route publique, skipAuth) ────────────────────────────
  const [etablissementId, setEtablissementId] = React.useState<string>("");
  const { data: etablissements, isLoading: etabsLoading } = useQuery<
    Etablissement[]
  >({
    queryKey: ["public-etablissements"],
    queryFn: () =>
      apiGet<Etablissement[]>("/api/etablissements", { skipAuth: true }),
    staleTime: 5 * 60 * 1000,
  });

  const selectedEtablissement = React.useMemo(
    () => etablissements?.find((e) => e.id === etablissementId),
    [etablissements, etablissementId],
  );
  const appliqueCategorie =
    !!selectedEtablissement?.applique_categorie_affecte;

  // ─── Cycles & Classes (cascade) ───────────────────────────────────────────
  // Sur la page publique, on appelle /api/cycles et /api/classes avec
  // `skipAuth: true` pour éviter l'effet de bord « 401 → refresh → logout() »
  // du client API générique (qui viderait la session parent si le visiteur
  // est connecté par ailleurs). Si le backend renvoie 401 (routes actuellement
  // protégées), la cascade restera vide et le champ classe_id sera facultatif.
  // Les clés de cache React Query sont partagées avec le reste de l'app.
  const [cycleId, setCycleId] = React.useState<string>("all");
  const [niveau, setNiveau] = React.useState<string>("all");
  const [classeId, setClasseId] = React.useState<string>("");

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: cyclesKeys.list(etablissementId || undefined),
    queryFn: () =>
      apiGet<Cycle[]>(
        `/api/cycles?etablissement_id=${encodeURIComponent(etablissementId)}`,
        { skipAuth: true },
      ),
    enabled: !!etablissementId,
    retry: false,
  });
  const { data: classes } = useQuery<Classe[]>({
    queryKey: classesKeys.list(etablissementId || undefined),
    queryFn: () =>
      apiGet<Classe[]>(
        `/api/classes?etablissement_id=${encodeURIComponent(etablissementId)}`,
        { skipAuth: true },
      ),
    enabled: !!etablissementId,
    retry: false,
  });

  // Cascade : reset niveau + classe quand cycle change
  const prevCycle = React.useRef(cycleId);
  React.useEffect(() => {
    if (prevCycle.current !== cycleId) {
      prevCycle.current = cycleId;
      setNiveau("all");
      setClasseId("");
    }
  }, [cycleId]);
  const prevNiveau = React.useRef(niveau);
  React.useEffect(() => {
    if (prevNiveau.current !== niveau) {
      prevNiveau.current = niveau;
      setClasseId("");
    }
  }, [niveau]);

  const availableNiveaux = React.useMemo(() => {
    if (!classes) return [];
    const filtered =
      cycleId !== "all" ? classes.filter((c) => c.cycle_id === cycleId) : classes;
    return [...new Set(filtered.map((c) => c.niveau))].sort((a, b) => a - b);
  }, [classes, cycleId]);

  const filteredClasses = React.useMemo(() => {
    if (!classes) return [];
    return classes.filter((c) => {
      if (cycleId !== "all" && c.cycle_id !== cycleId) return false;
      if (niveau !== "all" && c.niveau !== Number(niveau)) return false;
      return true;
    });
  }, [classes, cycleId, niveau]);

  // ─── État du formulaire ───────────────────────────────────────────────────
  const [eleveNom, setEleveNom] = React.useState("");
  const [elevePrenoms, setElevePrenoms] = React.useState("");
  const [eleveDateNaissance, setEleveDateNaissance] = React.useState("");
  const [eleveLieuNaissance, setEleveLieuNaissance] = React.useState("");
  const [eleveSexe, setEleveSexe] = React.useState<SexeEleve>("");
  const [eleveCategorie, setEleveCategorie] =
    React.useState<CategorieEleve>("NON_APPLICABLE");

  const [tuteurNom, setTuteurNom] = React.useState("");
  const [tuteurPrenoms, setTuteurPrenoms] = React.useState("");
  const [tuteurTelephone, setTuteurTelephone] = React.useState("");
  const [tuteurEmail, setTuteurEmail] = React.useState("");
  const [tuteurLienParente, setTuteurLienParente] =
    React.useState<LienParente>("AUTRE");

  const [notesParent, setNotesParent] = React.useState("");

  // ─── Champs complémentaires (transfert + santé) ───────────────────────────
  const [eleveAncienEtablissement, setEleveAncienEtablissement] =
    React.useState("");
  const [eleveAllergies, setEleveAllergies] = React.useState("");
  const [eleveNotesSante, setEleveNotesSante] = React.useState("");

  // ─── Détection fratrie (debounce téléphone) ───────────────────────────────
  // On debounce le téléphone 500 ms avant de lancer la recherche fratrie
  // (route publique `searchTuteurByPhone`) pour éviter une requête par frappe.
  // Si un tuteur existant est trouvé, on affiche une bannière emerald et un
  // bouton « Pré-remplir mes informations » qui remplit les champs tuteur.
  // `retry: false` évite les retries sur 404 (tuteur inconnu = comportement
  // normal, silencieux).
  const [debouncedTelephone, setDebouncedTelephone] = React.useState("");
  React.useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedTelephone(tuteurTelephone.trim()),
      500,
    );
    return () => clearTimeout(handle);
  }, [tuteurTelephone]);

  const fratrieQuery = useQuery<TuteurFratrieResult>({
    queryKey: ["public-fratrie", debouncedTelephone],
    queryFn: () => searchTuteurByPhone(debouncedTelephone),
    enabled: debouncedTelephone.length >= 8,
    retry: false,
    staleTime: 60 * 1000,
  });
  const fratrieResult = fratrieQuery.data;
  const fratrieFetching = fratrieQuery.isFetching;

  /** Pré-remplit les champs tuteur depuis le résultat de la recherche fratrie. */
  function handlePrefillTuteur() {
    if (!fratrieResult?.found || !fratrieResult.tuteur) return;
    const t = fratrieResult.tuteur;
    if (t.nom) setTuteurNom(t.nom);
    if (t.prenoms) setTuteurPrenoms(t.prenoms);
    if (t.email) setTuteurEmail(t.email);
    const liensValides: LienParente[] = [
      "PERE",
      "MERE",
      "TUTEUR_LEGAL",
      "AUTRE",
    ];
    const lien = liensValides.includes(t.lien_parente as LienParente)
      ? (t.lien_parente as LienParente)
      : "AUTRE";
    setTuteurLienParente(lien);
    toast({
      title: "Informations pré-remplies",
      description:
        "Vous pouvez ajuster les champs si besoin. Votre saisie reste prioritaire.",
    });
  }

  // ─── Succès ───────────────────────────────────────────────────────────────
  const [success, setSuccess] = React.useState<SubmitResult | null>(null);

  // ─── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (dto: PreInscriptionDTO) => submitPreInscription(dto),
    onSuccess: (data) => {
      setSuccess(data);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      toast({
        title: "Pré-inscription envoyée",
        description:
          "Votre demande a bien été soumise. Conservez votre lien de suivi.",
      });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue lors de la soumission. Veuillez réessayer.";
      toast({
        title: "Échec de la pré-inscription",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ─── Validation ───────────────────────────────────────────────────────────
  const isValid = React.useMemo(() => {
    if (!etablissementId) return false;
    if (!eleveNom.trim()) return false;
    if (!eleveSexe) return false;
    if (appliqueCategorie && eleveCategorie === "NON_APPLICABLE") return false;
    if (!tuteurNom.trim()) return false;
    if (!tuteurTelephone.trim()) return false;
    return true;
  }, [
    etablissementId,
    eleveNom,
    eleveSexe,
    appliqueCategorie,
    eleveCategorie,
    tuteurNom,
    tuteurTelephone,
  ]);

  // ─── Soumission ───────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || mutation.isPending) return;

    const dto: PreInscriptionDTO = {
      etablissement_id: etablissementId,
      eleve_nom: eleveNom.trim(),
      eleve_prenoms: elevePrenoms.trim(),
      eleve_date_naissance: eleveDateNaissance || undefined,
      eleve_lieu_naissance: eleveLieuNaissance.trim(),
      eleve_sexe: eleveSexe,
      eleve_categorie: appliqueCategorie ? eleveCategorie : "NON_APPLICABLE",
      eleve_ancien_etablissement:
        eleveAncienEtablissement.trim() || undefined,
      eleve_allergies: eleveAllergies.trim() || undefined,
      eleve_notes_sante: eleveNotesSante.trim() || undefined,
      tuteur_nom: tuteurNom.trim(),
      tuteur_prenoms: tuteurPrenoms.trim(),
      tuteur_telephone: tuteurTelephone.trim(),
      tuteur_email: tuteurEmail.trim(),
      tuteur_lien_parente: tuteurLienParente,
      classe_id: classeId || undefined,
      notes_parent: notesParent.trim(),
    };
    mutation.mutate(dto);
  }

  // ─── Copie du lien de suivi ───────────────────────────────────────────────
  function handleCopyLien() {
    if (!success) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${success.suivi_url}`
        : success.suivi_url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () =>
          toast({
            title: "Lien copié",
            description: "Le lien de suivi a été copié dans le presse-papiers.",
          }),
        () =>
          toast({
            title: "Copie impossible",
            description: url,
            variant: "destructive",
          }),
      );
    } else {
      toast({ title: "Lien de suivi", description: url });
    }
  }

  // ─── Écran de succès ──────────────────────────────────────────────────────
  if (success) {
    return <SuccessScreen result={success} onCopy={handleCopyLien} />;
  }

  // ─── Formulaire ───────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      {/* Orbes décoratifs (glassmorphism léger) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      {/* En-tête */}
      <header className="relative z-10 border-b border-emerald-100/60 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
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
              Pré-inscription en ligne
            </p>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero */}
        <div className="mb-8 text-center sm:mb-10">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Pré-inscription en ligne
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Remplissez ce formulaire pour pré-inscrire votre enfant. Le
            secrétariat de l&apos;établissement étudiera votre demande et
            confirmera l&apos;inscription sous 48h.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ─── Établissement ───────────────────────────────────────────────── */}
          <Card className="border-emerald-100">
            <CardContent className="space-y-4 py-6">
              <SectionHeader
                icon={School}
                title="Établissement souhaité"
                description="Choisissez l'établissement auprès duquel vous pré-inscrivez votre enfant."
              />
              <Separator />
              <Field
                label="Établissement"
                required
                hint="Liste des établissements actifs du groupe ScolaGest."
              >
                <Select
                  value={etablissementId || "none"}
                  onValueChange={(v) =>
                    setEtablissementId(v === "none" ? "" : v)
                  }
                  disabled={etabsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        etabsLoading
                          ? "Chargement…"
                          : "Sélectionnez un établissement"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sélectionnez…</SelectItem>
                    {etablissements?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom}
                        {e.ville ? ` — ${e.ville}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {selectedEtablissement?.applique_categorie_affecte && (
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  Cet établissement applique la distinction{" "}
                  <strong>Affecté / Non affecté</strong>. Vous devrez renseigner
                  la catégorie de votre enfant.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Élève ───────────────────────────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 py-6">
              <SectionHeader
                icon={User}
                title="Identité de l'élève"
                description="Renseignez l'état civil de votre enfant."
              />
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom" required>
                  <Input
                    value={eleveNom}
                    onChange={(e) => setEleveNom(e.target.value)}
                    placeholder="Ex : Kouassi"
                    autoComplete="family-name"
                  />
                </Field>
                <Field label="Prénoms">
                  <Input
                    value={elevePrenoms}
                    onChange={(e) => setElevePrenoms(e.target.value)}
                    placeholder="Ex : Jean-Marc"
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Date de naissance">
                  <Input
                    type="date"
                    value={eleveDateNaissance}
                    onChange={(e) => setEleveDateNaissance(e.target.value)}
                  />
                </Field>
                <Field label="Lieu de naissance">
                  <Input
                    value={eleveLieuNaissance}
                    onChange={(e) => setEleveLieuNaissance(e.target.value)}
                    placeholder="Ex : Abidjan"
                  />
                </Field>
                <Field label="Sexe" required>
                  <Select
                    value={eleveSexe || "none"}
                    onValueChange={(v) =>
                      setEleveSexe(v === "none" ? "" : (v as SexeEleve))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sélectionnez…</SelectItem>
                      <SelectItem value="M">Masculin</SelectItem>
                      <SelectItem value="F">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {appliqueCategorie && (
                  <Field
                    label="Catégorie"
                    required
                    hint="Affecté = élève de l'État (exonéré). Non affecté = élève ordinaire."
                  >
                    <Select
                      value={eleveCategorie}
                      onValueChange={(v) =>
                        setEleveCategorie(v as CategorieEleve)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AFFECTE">Affecté (État)</SelectItem>
                        <SelectItem value="NON_AFFECTE">
                          Non affecté
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Tuteur ──────────────────────────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 py-6">
              <SectionHeader
                icon={Users}
                title="Tuteur / Parent"
                description="Vos coordonnées pour que l'établissement vous contacte."
              />
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom" required>
                  <Input
                    value={tuteurNom}
                    onChange={(e) => setTuteurNom(e.target.value)}
                    placeholder="Ex : Kouassi"
                    autoComplete="family-name"
                  />
                </Field>
                <Field label="Prénoms">
                  <Input
                    value={tuteurPrenoms}
                    onChange={(e) => setTuteurPrenoms(e.target.value)}
                    placeholder="Ex : Marc"
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Téléphone" required>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="tel"
                      value={tuteurTelephone}
                      onChange={(e) => setTuteurTelephone(e.target.value)}
                      placeholder="Ex : +225 07 00 00 00 00"
                      className="pl-9"
                      autoComplete="tel"
                    />
                    {fratrieFetching && (
                      <Loader2
                        aria-label="Recherche d'une fratrie existante en cours"
                        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-emerald-600"
                      />
                    )}
                  </div>
                </Field>
                <Field label="Email">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={tuteurEmail}
                      onChange={(e) => setTuteurEmail(e.target.value)}
                      placeholder="Ex : parent@example.com"
                      className="pl-9"
                      autoComplete="email"
                    />
                  </div>
                </Field>
                <Field label="Lien de parenté">
                  <Select
                    value={tuteurLienParente || "AUTRE"}
                    onValueChange={(v) => setTuteurLienParente(v as LienParente)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERE">Père</SelectItem>
                      <SelectItem value="MERE">Mère</SelectItem>
                      <SelectItem value="TUTEUR_LEGAL">
                        Tuteur légal
                      </SelectItem>
                      <SelectItem value="AUTRE">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {fratrieResult?.found && fratrieResult.tuteur && (
                <FratrieBanner
                  result={fratrieResult}
                  onPrefill={handlePrefillTuteur}
                />
              )}
            </CardContent>
          </Card>

          {/* ─── Classe souhaitée ────────────────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 py-6">
              <SectionHeader
                icon={GraduationCap}
                title="Classe souhaitée"
                description="Indiquez la classe visée (facultatif mais recommandé)."
              />
              <Separator />
              {!etablissementId ? (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="size-4 shrink-0" />
                  Sélectionnez d&apos;abord un établissement pour voir les
                  classes disponibles.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Cycle">
                    <Select value={cycleId} onValueChange={setCycleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tous cycles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous cycles</SelectItem>
                        {cycles?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Niveau">
                    <Select value={niveau} onValueChange={setNiveau}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tous niveaux" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous niveaux</SelectItem>
                        {availableNiveaux.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            Niveau {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Classe">
                    <Select
                      value={classeId || "none"}
                      onValueChange={(v) =>
                        setClasseId(v === "none" ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non précisée</SelectItem>
                        {filteredClasses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.libelle}
                            {c.est_classe_examen ? " (examen)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Informations complémentaires ─────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 py-6">
              <SectionHeader
                icon={HeartPulse}
                title="Informations complémentaires"
                description="Optionnel : renseignements de transfert et de santé de l'enfant."
              />
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Ancien établissement (si transfert)"
                  hint="Précédent établissement fréquenté par l'enfant."
                >
                  <Input
                    value={eleveAncienEtablissement}
                    onChange={(e) =>
                      setEleveAncienEtablissement(e.target.value)
                    }
                    placeholder="Ex: Collège Saint-Michel"
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Allergies connues"
                  hint="Séparez les allergies par une virgule."
                >
                  <Input
                    value={eleveAllergies}
                    onChange={(e) => setEleveAllergies(e.target.value)}
                    placeholder="Ex: arachides, pénicilline"
                    autoComplete="off"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Notes santé (maladies chroniques, traitements…)">
                    <Textarea
                      value={eleveNotesSante}
                      onChange={(e) => setEleveNotesSante(e.target.value)}
                      placeholder="Ex: asthme, port de lunettes"
                      rows={2}
                    />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Notes ───────────────────────────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 py-6">
              <SectionHeader
                icon={ClipboardCopy}
                title="Message au secrétariat"
                description="Précisions éventuelles (classe demandée en seconde intention, infos utiles…)."
              />
              <Separator />
              <Field label="Notes (optionnel)">
                <Textarea
                  value={notesParent}
                  onChange={(e) => setNotesParent(e.target.value)}
                  placeholder="Ex : Nous souhaiterions une classe de 6e A si possible. Merci de nous contacter le soir."
                  rows={3}
                />
              </Field>
            </CardContent>
          </Card>

          {/* ─── Action ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-end">
            <p className="text-xs text-muted-foreground sm:mr-auto">
              En soumettant, vous acceptez que vos données soient traitées pour
              instruire votre demande.
            </p>
            <Button
              type="submit"
              disabled={!isValid || mutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Soumettre la pré-inscription
                </>
              )}
            </Button>
          </div>
        </form>
      </main>

      {/* Pied de page */}
      <footer className="relative z-10 mt-auto border-t border-emerald-100/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>ScolaGest · Pré-inscription en ligne</p>
          <p className="text-[11px]">
            Groupe Scolaire Le Chandelier — Dabou, Côte d&apos;Ivoire
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bannière de détection fratrie
// ─────────────────────────────────────────────────────────────────────────────

function FratrieBanner({
  result,
  onPrefill,
}: {
  result: TuteurFratrieResult;
  onPrefill: () => void;
}) {
  if (!result.found || !result.tuteur) return null;
  const t = result.tuteur;
  const nomComplet = [t.prenoms, t.nom].filter(Boolean).join(" ").trim();
  const nb = result.eleves?.length ?? 0;

  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            Tuteur reconnu ! {nomComplet || "Ce tuteur"} a déjà {nb}{" "}
            enfant{nb > 1 ? "s" : ""} inscrit{nb > 1 ? "s" : ""} à cet
            établissement.
          </p>
          {nb > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.eleves.map((el, i) => {
                const nom = [el.prenoms, el.nom]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                return (
                  <Badge
                    key={`${nom}-${i}`}
                    variant="outline"
                    className="border-emerald-300 bg-white/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    <Users className="mr-1 size-3" />
                    {nom}
                  </Badge>
                );
              })}
            </div>
          )}
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onPrefill}
              className="border-emerald-300 bg-white/80 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
            >
              <Wand2 className="size-3.5" />
              Pré-remplir mes informations
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran de succès
// ─────────────────────────────────────────────────────────────────────────────

function SuccessScreen({
  result,
  onCopy,
}: {
  result: SubmitResult;
  onCopy: () => void;
}) {
  const suiviUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${result.suivi_url}`
      : result.suivi_url;
  const pre = result.pre_inscription;
  const eleveNomComplet = [pre.eleve_prenoms, pre.eleve_nom]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <Card className="overflow-hidden border-emerald-200 shadow-lg shadow-emerald-600/10 dark:border-emerald-900/50">
          <CardContent className="space-y-6 py-8">
            {/* Icône + titre */}
            <div className="flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="size-9" />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight">
                Pré-inscription envoyée
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Votre demande pour{" "}
                <span className="font-semibold text-foreground">
                  {eleveNomComplet || "votre enfant"}
                </span>{" "}
                a bien été transmise à l&apos;établissement. Le secrétariat
                l&apos;étudiera dans les meilleurs délais.
              </p>
            </div>

            <Separator />

            {/* Récap rapide */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                <CalendarDays className="size-3.5" />
                Soumise le{" "}
                {new Date(pre.date_soumission).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  Statut : Soumise
                </Badge>
                {pre.classe && (
                  <Badge variant="outline" className="border-emerald-200">
                    Classe souhaitée : {pre.classe.libelle}
                  </Badge>
                )}
              </div>
            </div>

            {/* Token de suivi */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Votre jeton de suivi
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2.5 font-mono text-sm">
                <span className="flex-1 truncate select-all">
                  {result.token_suivi}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Conservez ce jeton : il vous permet de suivre l&apos;état de
                votre demande sans compte.
              </p>
            </div>

            {/* Lien de suivi */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lien de suivi
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  asChild
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Link href={result.suivi_url}>
                    <GraduationCap className="size-4" />
                    Suivre ma demande
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCopy}
                  className="flex-1 sm:flex-none"
                >
                  <ClipboardCopy className="size-4" />
                  Copier le lien
                </Button>
              </div>
              <p className="break-all rounded-md bg-muted/30 p-2 text-[11px] text-muted-foreground">
                {suiviUrl}
              </p>
            </div>

            <Separator />

            {/* Lien retour */}
            <div className="text-center">
              <Button asChild variant="ghost" size="sm">
                <Link href="/pre-inscription">
                  Faire une nouvelle pré-inscription
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="relative z-10 mt-auto border-t border-emerald-100/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>ScolaGest · Pré-inscription en ligne</p>
          <p className="text-[11px]">
            Groupe Scolaire Le Chandelier — Dabou, Côte d&apos;Ivoire
          </p>
        </div>
      </footer>
    </div>
  );
}
