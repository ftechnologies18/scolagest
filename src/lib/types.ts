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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Module de caisse : Frais, Échéances, Soldes, Paiements, Reçus,
// Clôture de caisse.
// ─────────────────────────────────────────────────────────────────────────────

export type TypeFrais = "INSCRIPTION" | "SCOLARITE" | "EXAMEN" | "ANNEXE";

/** Catégorie affectée (null = tarif unique). */
export type CategorieFrais = "AFFECTE" | "NON_AFFECTE" | null;

/** Frais configuré pour une année scolaire, éventuellement ciblé par cycle/classe. */
export interface Frais {
  id: string;
  etablissement_id: string;
  annee_scolaire_id: string;
  cycle_id: string | null;
  classe_id: string | null;
  type_frais: TypeFrais;
  categorie: CategorieFrais;
  libelle: string;
  montant_total: number;
  nb_versements_defaut: number;
  actif: boolean;
  echeances?: Echeance[];
  cycle?: Cycle;
  classe?: Classe;
  annee_scolaire?: AnneeScolaire;
}

/** Échéance de paiement (générique ou spécifique à un élève en cas de dérogation). */
export interface Echeance {
  id: string;
  frais_id: string;
  eleve_id: string | null;
  rang: number;
  libelle: string;
  montant: number;
  date_limite: string;
  motif_derogation: string;
}

export interface EcheanceDTO {
  rang: number;
  libelle: string;
  montant: number;
  date_limite: string;
}

export interface FraisDTO {
  cycle_id?: string | null;
  classe_id?: string | null;
  type_frais: TypeFrais;
  categorie?: CategorieFrais;
  libelle: string;
  montant_total: number;
  nb_versements_defaut: number;
  echeances: EcheanceDTO[];
  actif?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Soldes (calculés côté backend)
// ─────────────────────────────────────────────────────────────────────────────

export interface SoldeFrais {
  frais_id: string;
  type_frais: TypeFrais;
  libelle: string;
  montant_attendu: number;
  montant_paye: number;
  solde: number;
}

export type StatutEcheance =
  | "PAYE"
  | "PARTIEL"
  | "EN_RETARD"
  | "A_VENIR";

export interface EcheanceStatut {
  echeance_id: string;
  rang: number;
  libelle: string;
  montant: number;
  date_limite: string;
  montant_paye: number;
  statut: StatutEcheance;
}

export interface SoldeEleve {
  eleve_id: string;
  frais_attendus: SoldeFrais[];
  total_attendu: number;
  total_paye: number;
  solde_du: number;
  echeances_a_venir: EcheanceStatut[];
}

export type StatutSolde = "SOLDE" | "PARTIEL" | "IMPAYE" | string;

export interface SoldeListItem {
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  classe: string;
  total_attendu: number;
  total_paye: number;
  solde_du: number;
  statut: StatutSolde;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paiements (encaissements)
// ─────────────────────────────────────────────────────────────────────────────

export type ModePaiement =
  | "ESPECES"
  | "CHEQUE"
  | "VIREMENT"
  | "MOBILE_MONEY";

export type StatutPaiement = "VALIDE" | "ANNULE" | "EN_ATTENTE";

export interface Caissier {
  id: string;
  nom: string;
  prenoms: string;
}

export interface Paiement {
  id: string;
  eleve_id: string;
  inscription_id: string;
  etablissement_id: string;
  frais_id: string | null;
  echeance_id: string | null;
  montant: number;
  mode_paiement: ModePaiement;
  provider_momo: string | null;
  reference_externe: string;
  date_paiement: string;
  caissier_id: string;
  statut: StatutPaiement;
  numero_recu: string;
  motif_annulation: string;
  eleve?: Eleve;
  frais?: Frais;
  echeance?: Echeance;
  caissier?: Caissier;
  recu?: Recu;
}

export interface PaiementDTO {
  eleve_id: string;
  frais_id?: string | null;
  echeance_id?: string | null;
  montant: number;
  mode_paiement: ModePaiement;
  provider_momo?: string | null;
  reference_externe?: string;
  date_paiement?: string;
}

export interface PaiementsListResponse {
  data: Paiement[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaiementsQueryParams {
  eleve_id?: string;
  date_debut?: string;
  date_fin?: string;
  caissier_id?: string;
  mode?: ModePaiement;
  page?: number;
  page_size?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reçu
// ─────────────────────────────────────────────────────────────────────────────

export interface RecuSnapshotEleve {
  nom: string;
  prenoms: string;
  matricule: string;
  classe: string;
}

export interface RecuSnapshotEtablissement {
  nom: string;
  ville?: string;
  code_officiel?: string;
}

export interface RecuSnapshotPaiement {
  montant: number;
  mode: ModePaiement;
  motif: string;
  caissier: string;
  date: string;
  reference_externe?: string;
  provider_momo?: string | null;
}

export interface RecuSnapshot {
  etablissement?: RecuSnapshotEtablissement;
  eleve?: RecuSnapshotEleve;
  paiement?: RecuSnapshotPaiement;
  solde_restant?: number;
  total_paye?: number;
  total_attendu?: number;
}

export interface Recu {
  id: string;
  paiement_id: string;
  numero: string;
  pdf_url: string;
  contenu_snapshot: string; // JSON string à parser en RecuSnapshot
  date_emission: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clôture de caisse
// ─────────────────────────────────────────────────────────────────────────────

export type StatutCloture = "OUVERTE" | "CLOTUREE" | "VALIDEE";

export interface ClotureCaisse {
  id: string;
  caissier_id: string;
  etablissement_id: string;
  date_cloture: string;
  total_theorique: number;
  total_remis: number;
  ecart: number;
  statut: StatutCloture;
  valide_par: string | null;
  notes: string;
  caissier?: Caissier;
}

export interface ClotureDTO {
  total_remis: number;
  notes?: string;
}

export interface CloturesQueryParams {
  date?: string;
  caissier_id?: string;
}
