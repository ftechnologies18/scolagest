import {
  Building2,
  Users,
  Receipt,
  Wallet,
  ShieldCheck,
  MessageSquare,
  BookOpen,
  Database,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Domain = {
  id: number;
  icon: LucideIcon;
  name: string;
  description: string;
  entities: string[];
};

const DOMAINS: Domain[] = [
  {
    id: 1,
    icon: Building2,
    name: "Référentiel & multi-sites",
    description:
      "Structuration du Groupe par établissements, années scolaires, cycles et classes.",
    entities: ["Etablissement", "AnneeScolaire", "Cycle", "Classe"],
  },
  {
    id: 2,
    icon: Users,
    name: "Élèves & tuteurs",
    description:
      "Fiches élèves, matricules (MEN / interne provisoire), tuteurs, inscriptions et historique.",
    entities: ["Eleve", "Tuteur", "TuteurEleve", "Inscription", "Document"],
  },
  {
    id: 3,
    icon: Receipt,
    name: "Facturation",
    description:
      "Paramétrage des frais (inscription, scolarité, examen, annexe) et échéanciers, avec dérogations.",
    entities: ["Frais", "Echeance"],
  },
  {
    id: 4,
    icon: Wallet,
    name: "Caisse & paiements",
    description:
      "Encaissements, reçus, clôtures journalières, transactions Mobile Money.",
    entities: ["Paiement", "Recu", "ClotureCaisse", "TransactionMobileMoney"],
  },
  {
    id: 5,
    icon: ShieldCheck,
    name: "Utilisateurs & sécurité",
    description: "RBAC multi-établissements, sessions JWT, journal d'audit.",
    entities: ["Utilisateur", "EtablissementAccess", "Session", "JournalAudit"],
  },
  {
    id: 6,
    icon: MessageSquare,
    name: "Communication",
    description: "Modèles et envois de SMS/Email de relance (V1 étendu).",
    entities: ["TemplateMessage", "EnvoiMessage"],
  },
  {
    id: 7,
    icon: BookOpen,
    name: "Comptabilité générale",
    description:
      "Exercices, plan comptable, journaux, écritures en partie double (V1 étendu).",
    entities: [
      "ExerciceComptable",
      "CompteComptable",
      "JournalComptable",
      "EcritureComptable",
      "LigneEcriture",
    ],
  },
];

export function DataModelOverview() {
  const totalEntities = DOMAINS.reduce((acc, d) => acc + d.entities.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
          <Database className="size-3.5 mr-1" />
          {totalEntities} entités
        </Badge>
        <Badge variant="outline" className="border-emerald-300 text-emerald-700">
          {DOMAINS.length} domaines fonctionnels
        </Badge>
        <Badge variant="outline" className="border-amber-300 text-amber-700">
          4 modules V1 étendus
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground max-w-3xl">
        Le modèle de données couvre l&apos;ensemble du périmètre V1 : gestion des
        élèves et du matricule, catégories affecté/non-affecté, facturation
        échelonnée, caisse et reçus, et — en extension — Mobile Money, relances
        SMS/Email, comptabilité générale en partie double, et architecture
        multi-établissements.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOMAINS.map((domain) => {
          const Icon = domain.icon;
          return (
            <Card
              key={domain.id}
              className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {domain.id}. {domain.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {domain.entities.length} entité
                      {domain.entities.length > 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {domain.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {domain.entities.map((entity) => (
                    <code
                      key={entity}
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground"
                    >
                      {entity}
                    </code>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="size-2 rounded-full bg-amber-500" />
            Règles métier clés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              <strong className="text-foreground">Catégorie d&apos;élève :</strong>{" "}
              <code className="text-xs">NON_APPLICABLE</code> pour le préscolaire
              et le primaire (pas d&apos;affectation par l&apos;État).
            </li>
            <li>
              <strong className="text-foreground">Matricule :</strong> MEN unique
              globalement, attribué à partir du CP1 ; identifiant interne
              provisoire pour le préscolaire.
            </li>
            <li>
              <strong className="text-foreground">Dérogation sociale :</strong>{" "}
              frais d&apos;inscription d&apos;un affecté en 3 tranches, accordée
              cas par cas (rôle Administrateur), tracée dans{" "}
              <code className="text-xs">Inscription</code>.
            </li>
            <li>
              <strong className="text-foreground">Scolarité échelonnée :</strong>{" "}
              5 tranches (collège/lycée, oct.→fév.) ou 4 tranches
              (primaire/préscolaire, nov.→fév.), configurable par année.
            </li>
            <li>
              <strong className="text-foreground">Partie double :</strong> chaque
              paiement valide génère une écriture comptable équilibrée.
            </li>
            <li>
              <strong className="text-foreground">Multi-sites :</strong>{" "}
              <code className="text-xs">EtablissementAccess</code> gère le rôle
              par établissement (un caissier peut travailler sur 2 sites).
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
