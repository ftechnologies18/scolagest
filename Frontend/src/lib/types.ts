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
  cycle_id?: string;
  niveau?: number;
  categorie?: CategorieEleve;
  statut?: StatutEleve;
  page?: number;
  page_size?: number;
}

/** Statistiques agrégées sur un ensemble d'élèves (contextualisées aux filtres). */
export interface EleveStats {
  total: number;
  garcons: number;
  filles: number;
  redoublants: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Rapports & tableaux de bord
//
// Types consommés par `src/lib/api-reports.ts` et les composants
// `src/components/dashboard/dashboard-home.tsx`, `view-rapports.tsx`,
// `view-impayes.tsx` ainsi que les graphiques CSS dans
// `src/components/reports/`.
// ─────────────────────────────────────────────────────────────────────────────

/** KPIs agrégés renvoyés par GET /api/dashboard. */
export interface DashboardKpis {
  /** Somme des paiements valides sur la période filtrée. */
  total_encaisse: number;
  /** Somme attendue (frais applicables) sur l'année scolaire courante. */
  total_attendu: number;
  /** total_encaisse / total_attendu * 100. */
  taux_recouvrement: number;
  /** Nombre d'élèves avec solde_du > 0. */
  nb_impayes: number;
  /** Nombre total d'élèves inscrits (année courante). */
  nb_eleves: number;
  /** Nombre de paiements enregistrés aujourd'hui. */
  nb_paiements_jour: number;
  /** Montant total encaissé aujourd'hui. */
  montant_jour: number;
}

/** Ligne de répartition par cycle / classe / catégorie de frais. */
export interface RepartitionItem {
  /** Libellé (cycle, classe ou catégorie selon l'axe). */
  libelle: string;
  /** Champ alternatif pour rétro-compatibilité (cycle/classe/categorie). */
  cycle?: string;
  classe?: string;
  categorie?: string;
  attendu: number;
  encaisse: number;
  /** Taux de recouvrement en pourcentage (0-100). */
  taux: number;
  /** Effectif concerné (le cas échéant). */
  nb_eleves?: number;
  nb_impayes?: number;
}

/** Répartition par mode de paiement. */
export interface RepartitionModePaiement {
  mode: string;
  montant: number;
  count: number;
}

/** Évolution mensuelle (12 derniers mois). */
export interface EvolutionMensuelle {
  /** Libellé du mois (ex : "janv.", "févr."). */
  mois: string;
  montant: number;
}

/** Réponse complète de GET /api/dashboard. */
export interface DashboardData {
  kpis: DashboardKpis;
  par_cycle: RepartitionItem[];
  par_classe: RepartitionItem[];
  par_categorie: RepartitionItem[];
  par_mode_paiement: RepartitionModePaiement[];
  evolution_mensuelle: EvolutionMensuelle[];
  /** 10 derniers paiements valides. */
  derniers_paiements: Paiement[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapports (paiements / soldes / recouvrement)
// ─────────────────────────────────────────────────────────────────────────────

export interface RapportPaiementsFilters {
  date_debut?: string;
  date_fin?: string;
  cycle_id?: string;
  classe_id?: string;
  categorie?: string;
  mode_paiement?: string;
  caissier_id?: string;
  /** Format d'export (impacts uniquement `downloadRapportPaiements`). */
  format?: "csv" | "excel";
}

export interface RapportPaiementsResult {
  data: Paiement[];
  total_montant: number;
  count: number;
}

export interface RapportSoldesFilters {
  classe_id?: string;
  categorie?: string;
  statut?: "SOLDE" | "IMPAYE" | "PARTIEL" | string;
}

export interface RapportSoldesResult {
  data: SoldeListItem[];
  total_attendu: number;
  total_paye: number;
  total_solde_du: number;
  count: number;
}

export interface RapportRecouvrementFilters {
  cycle_id?: string;
  classe_id?: string;
}

export interface RapportRecouvrementLigne {
  classe: string;
  attendu: number;
  encaisse: number;
  taux: number;
  nb_eleves: number;
  nb_impayes: number;
}

export interface RapportRecouvrementResult {
  data: RapportRecouvrementLigne[];
  resume: {
    attendu: number;
    encaisse: number;
    taux: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Impayés & relances
// ─────────────────────────────────────────────────────────────────────────────

/** Échéance en retard attachée à un élève impayé. */
export interface EcheanceEnRetard {
  echeance_id: string;
  libelle: string;
  montant: number;
  date_limite: string;
  jours_retard: number;
}

export interface ImpayeItem {
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  classe: string;
  categorie: string;
  total_attendu: number;
  total_paye: number;
  solde_du: number;
  echeances_en_retard: EcheanceEnRetard[];
  nb_jours_retard_max: number;
}

export interface ImpayesFilters {
  classe_id?: string;
  categorie?: string;
  /** Si `true`, ne renvoyer que les élèves ayant au moins une échéance en retard. */
  echeance_passee?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Modules avancés : Comptabilité générale, Mobile Money,
// SMS/Email, Multi-sites & Paramètres.
//
// Types consommés par `src/lib/api-phase5.ts` et les composants
// `src/components/dashboard/views/view-comptabilite.tsx`,
// `view-mobile-money.tsx`, `view-parametres.tsx` ainsi que les dialogues
// dédiés dans `src/components/comptabilite/`, `mobile-money/`, `parametres/`.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Comptabilité générale ───────────────────────────────────────────────────

export type StatutExercice = "OUVERT" | "CLOTURE";

export interface ExerciceComptable {
  id: string;
  etablissement_id: string;
  libelle: string;
  /** Date ISO. */
  date_debut: string;
  /** Date ISO. */
  date_fin: string;
  statut: StatutExercice;
  annee_scolaire_id?: string | null;
}

export interface ExerciceDTO {
  libelle: string;
  date_debut: string;
  date_fin: string;
  annee_scolaire_id?: string | null;
}

export type TypeCompte = "ACTIF" | "PASSIF" | "PRODUIT" | "CHARGE";

export interface CompteComptable {
  id: string;
  etablissement_id: string;
  /** Numéro de compte (ex : 411, 512, 706…). */
  numero: string;
  libelle: string;
  type: TypeCompte;
  parent_id?: string | null;
  parent?: { id: string; numero: string; libelle: string } | null;
  actif: boolean;
}

export interface CompteDTO {
  numero: string;
  libelle: string;
  type: TypeCompte;
  parent_id?: string | null;
  actif?: boolean;
}

export type TypeJournal = "CAISSE" | "BANQUE" | "OD" | "VENTES";

export interface JournalComptable {
  id: string;
  etablissement_id: string;
  code: string;
  libelle: string;
  type: TypeJournal;
  compte_contrepartie_id?: string | null;
}

export type StatutEcriture = "BROUILLON" | "VALIDEE";

export interface LigneEcriture {
  id?: string;
  ecriture_id?: string;
  compte_id: string;
  debit: number;
  credit: number;
  libelle?: string;
  compte?: { id: string; numero: string; libelle: string } | null;
}

export interface EcritureComptable {
  id: string;
  exercice_id: string;
  journal_id: string;
  paiement_id?: string | null;
  envoi_message_id?: string | null;
  /** Date ISO. */
  date_ecriture: string;
  numero_piece: string;
  libelle: string;
  statut: StatutEcriture;
  created_by?: string;
  journal?: JournalComptable | null;
  lignes?: LigneEcriture[];
  paiement?: { id: string; numero_recu: string } | null;
}

export interface EcrituresQueryParams {
  exercice_id?: string;
  journal_id?: string;
  date_debut?: string;
  date_fin?: string;
  page?: number;
  page_size?: number;
}

export interface EcrituresListResponse {
  data: EcritureComptable[];
  total: number;
  page: number;
  page_size: number;
}

export interface GrandLigneMouvement {
  date: string;
  numero_piece: string;
  libelle: string;
  debit: number;
  credit: number;
  /** Solde cumulé. */
  solde: number;
}

export interface GrandLigneCompte {
  compte_id: string;
  numero: string;
  libelle: string;
  solde_debit_ouv: number;
  solde_credit_ouv: number;
  mouvements: GrandLigneMouvement[];
  solde_debit_fin: number;
  solde_credit_fin: number;
}

export interface GrandLivreResult {
  comptes: GrandLigneCompte[];
  total_debit: number;
  total_credit: number;
}

export interface GrandLivreQueryParams {
  exercice_id?: string;
  compte_id?: string;
  date_debut?: string;
  date_fin?: string;
}

export interface BilanCompteLigne {
  compte_id: string;
  numero: string;
  libelle: string;
  montant: number;
}

export interface BilanSection {
  total: number;
  comptes: BilanCompteLigne[];
}

export interface BilanResult {
  actif: BilanSection;
  passif: BilanSection;
  produits: BilanSection;
  charges: BilanSection;
  /** Résultat = produits.total - charges.total. */
  resultat: number;
}

// ─── Mobile Money ────────────────────────────────────────────────────────────

export type ProviderMomo = "ORANGE_MONEY" | "MTN_MONEY" | "WAVE";

export type StatutTransactionMomo =
  | "INITIEE"
  | "EN_COURS"
  | "REUSSIE"
  | "ECHEC"
  | "REMBOURSEE";

export interface TransactionMomo {
  id: string;
  paiement_id?: string | null;
  eleve_id: string;
  etablissement_id: string;
  provider: ProviderMomo;
  montant: number;
  telephone_client: string;
  reference_externe: string;
  statut: StatutTransactionMomo;
  /** Payload JSON sérialisé par le backend. */
  payload_requete?: string | null;
  payload_reponse?: string | null;
  date_initiation: string;
  date_confirmation?: string | null;
  erreur?: string | null;
  eleve?: { id: string; nom: string; prenoms: string; identifiant_interne: string } | null;
}

export interface TransactionsMomoQueryParams {
  statut?: StatutTransactionMomo;
  provider?: ProviderMomo;
  date_debut?: string;
  date_fin?: string;
  page?: number;
  page_size?: number;
}

export interface TransactionsMomoListResponse {
  data: TransactionMomo[];
  total: number;
  page: number;
  page_size: number;
}

export interface InitierMomoDTO {
  eleve_id: string;
  frais_id?: string | null;
  montant: number;
  provider: ProviderMomo;
  telephone_client: string;
}

export interface WebhookMomo {
  id: string;
  provider: ProviderMomo;
  reference_externe: string;
  statut: string;
  payload: string;
  date_reception: string;
  transaction_id?: string | null;
  reconcilie?: boolean;
}

// ─── SMS / Email (Communication) ──────────────────────────────────────────────

export type TypeMessage = "SMS" | "EMAIL";

export type StatutEnvoi =
  | "EN_ATTENTE"
  | "ENVOYE"
  | "ECHEC"
  | "DELIVRE";

export interface TemplateMessage {
  id: string;
  etablissement_id?: string | null;
  code: string;
  type: TypeMessage;
  sujet?: string | null;
  corps: string;
  actif: boolean;
}

export interface TemplateMessageDTO {
  code: string;
  type: TypeMessage;
  sujet?: string;
  corps: string;
  etablissement_id?: string | null;
  actif?: boolean;
}

export interface EnvoiMessage {
  id: string;
  eleve_id?: string | null;
  tuteur_id?: string | null;
  etablissement_id: string;
  template_id?: string | null;
  type: TypeMessage;
  destinataire: string;
  contenu_genere: string;
  statut: StatutEnvoi;
  provider?: string;
  reference_externe?: string;
  date_creation: string;
  date_envoi?: string | null;
  erreur?: string | null;
  eleve?: { id: string; nom: string; prenoms: string } | null;
  tuteur?: { id: string; nom: string; prenoms: string } | null;
  template?: { id: string; code: string; type: TypeMessage } | null;
}

export interface EnvoiMessageDTO {
  eleve_id: string;
  template_id: string;
  type?: TypeMessage;
  destinataire_override?: string;
}

export interface RelanceMasseDTO {
  eleve_ids: string[];
  template_id: string;
}

export interface RelanceMasseResult {
  count: number;
  envoi_ids: string[];
}

export interface EnvoisMessageQueryParams {
  statut?: StatutEnvoi;
  type?: TypeMessage;
  date_debut?: string;
  date_fin?: string;
  page?: number;
  page_size?: number;
}

export interface EnvoisMessageListResponse {
  data: EnvoiMessage[];
  total: number;
  page: number;
  page_size: number;
}

// ─── Multi-sites & Paramètres : Utilisateurs + Audit ────────────────────────

/**
 * Rôle global d'un utilisateur.
 *
 * `SUPER_ADMIN` = propriétaire de la plateforme SaaS (gestion multi-tenant,
 * audit global, mode support). `DIRECTION` est désormais l'administrateur
 * d'établissement (rôle historiquement tenu par `ADMINISTRATEUR`).
 */
export type RoleGlobal =
  | "SUPER_ADMIN"
  | "CAISSIER"
  | "COMPTABLE"
  | "DIRECTION"
  | "DIRECTEUR_ETUDES"
  | "DIRECTEUR_SUPERVISEUR"
  | "SECRETARIAT"
  | "PARENT";

export interface EtablissementAccess {
  id: string;
  utilisateur_id: string;
  etablissement_id: string;
  role: RoleGlobal;
  etablissement?: { id: string; nom: string; ville?: string } | null;
}

export interface Utilisateur {
  id: string;
  nom: string;
  prenoms: string;
  email: string;
  role_global?: RoleGlobal | null;
  statut: string;
  accesses?: EtablissementAccess[];
}

export interface UtilisateurDTO {
  nom: string;
  prenoms?: string;
  email: string;
  password?: string;
  role_global?: RoleGlobal;
  statut?: string;
}

export interface EtablissementAccessDTO {
  etablissement_id: string;
  role: RoleGlobal;
}

export interface UtilisateursQueryParams {
  etablissement_id?: string;
  page?: number;
  page_size?: number;
}

export interface JournalAudit {
  id: string;
  utilisateur_id?: string | null;
  utilisateur?: { id: string; nom: string; prenoms: string; email: string } | null;
  action: string;
  entite: string;
  entite_id?: string | null;
  description?: string;
  adresse_ip?: string;
  /** Date ISO. */
  date_action: string;
}

export interface AuditQueryParams {
  entite?: string;
  utilisateur_id?: string;
  date_debut?: string;
  date_fin?: string;
  page?: number;
  page_size?: number;
}

export interface AuditListResponse {
  data: JournalAudit[];
  total: number;
  page: number;
  page_size: number;
}
