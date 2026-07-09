/**
 * ScolaGest — Types partagés du domaine "Élèves" (Phase 2)
 *
 * Ces types décrivent les réponses JSON du backend Go pour les entités
 * élèves, tuteurs, inscriptions, classes, cycles et années scolaires.
 * Ils sont consommés par `src/lib/api-students.ts` et par les composants
 * de `src/components/eleves/`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Élèves
// ─────────────────────────────────────────────────────────────────────────────

export type CategorieEleve = "AFFECTE" | "NON_AFFECTE" | "NON_APPLICABLE";

export type StatutEleve = "ACTIF" | "INACTIF" | "TRANSFERE" | "DIPLOME";

export type SexeEleve = "M" | "F" | "";

/** Établissement léger embarqué dans la fiche élève. */
export interface EleveEtablissement {
  id: string;
  nom: string;
  /** Indique si l'établissement applique la distinction Affecté / Non affecté. */
  applique_categorie_affecte: boolean;
}

export interface Eleve {
  id: string;
  etablissement_id: string;
  /** Matricule du Ministère de l'Éducation Nationale. null pour le préscolaire. */
  matricule_ministere: string | null;
  /** Identifiant interne auto-généré (ex. "EPV-2026-0001"). */
  identifiant_interne: string;
  nom: string;
  prenoms: string;
  /** Date ISO (YYYY-MM-DD). */
  date_naissance: string | null;
  lieu_naissance: string;
  sexe: SexeEleve;
  photo_url: string;
  categorie: CategorieEleve;
  statut: StatutEleve;
  tuteur_id: string | null;
  /** Présent dans la réponse de détail. */
  tuteur?: Tuteur | null;
  /** Présent dans la réponse de détail. */
  etablissement?: EleveEtablissement;
  /** Inscriptions historiques (détail uniquement). */
  inscriptions?: Inscription[];
  /** Inscription courante (calculée par le backend dans la liste). */
  inscription_courante?: InscriptionCouranteLite | null;
  created_at: string;
}

/** Inscription courante simplifiée, attachée à l'élève dans la liste. */
export interface InscriptionCouranteLite {
  id: string;
  classe_id: string;
  classe_libelle: string;
  annee_scolaire_id: string;
  annee_libelle: string;
  statut: StatutInscription;
}

export interface EleveDTO {
  nom: string;
  prenoms?: string;
  date_naissance?: string | null;
  lieu_naissance?: string;
  sexe?: SexeEleve;
  categorie: CategorieEleve;
  matricule_ministere?: string | null;
  photo_url?: string;
  tuteur_id?: string | null;
  statut?: StatutEleve;
}

export interface ElevesListResponse {
  data: Eleve[];
  total: number;
  page: number;
  page_size: number;
}

export interface ElevesQueryParams {
  search?: string;
  classe_id?: string;
  categorie?: CategorieEleve;
  statut?: StatutEleve;
  page?: number;
  page_size?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tuteurs
// ─────────────────────────────────────────────────────────────────────────────

export type LienParente =
  | "PERE"
  | "MERE"
  | "TUTEUR_LEGAL"
  | "AUTRE"
  | "";

export interface Tuteur {
  id: string;
  nom: string;
  prenoms: string;
  telephone: string;
  telephone2: string;
  email: string;
  adresse: string;
  lien_parente: LienParente;
  profession: string;
  actif: boolean;
  /** Présent dans la réponse de détail d'un tuteur. */
  eleves?: Eleve[];
}

export interface TuteurDTO {
  nom: string;
  prenoms?: string;
  telephone: string;
  telephone2?: string;
  email?: string;
  adresse?: string;
  lien_parente?: LienParente;
  profession?: string;
  actif?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inscriptions
// ─────────────────────────────────────────────────────────────────────────────

export type StatutInscription =
  | "INSCRIT"
  | "REINSCRIT"
  | "TRANSFERE"
  | "ABANDON";

export interface Inscription {
  id: string;
  eleve_id: string;
  etablissement_id: string;
  classe_id: string;
  annee_scolaire_id: string;
  /** Date ISO. */
  date_inscription: string;
  statut: StatutInscription;
  derogation_inscription: boolean;
  motif_derogation: string;
  classe?: { id: string; libelle: string };
  annee_scolaire?: { id: string; libelle: string };
}

export interface InscriptionDTO {
  classe_id: string;
  annee_scolaire_id: string;
  statut?: StatutInscription;
  derogation_inscription?: boolean;
  motif_derogation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycles & Classes
// ─────────────────────────────────────────────────────────────────────────────

export type LibelleCycle =
  | "PRESCOLAIRE"
  | "PRIMAIRE"
  | "COLLEGE"
  | "LYCEE"
  | string;

export interface Cycle {
  id: string;
  etablissement_id: string;
  libelle: LibelleCycle;
  ordre: number;
  classes?: Classe[];
}

export interface Classe {
  id: string;
  cycle_id: string;
  libelle: string;
  niveau: number;
  est_classe_examen: boolean;
  cycle?: Cycle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Années scolaires
// ─────────────────────────────────────────────────────────────────────────────

export type StatutAnnee = "PREPARATION" | "EN_COURS" | "CLOTUREE" | string;

export interface AnneeScolaire {
  id: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  statut: StatutAnnee;
  est_active: boolean;
}
