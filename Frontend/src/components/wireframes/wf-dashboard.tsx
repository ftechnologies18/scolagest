import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Coins,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  KpiCard,
  MiniBars,
  MiniDonut,
  PrimaryButton,
} from "./wf-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const recent = [
  {
    date: "14/03/2025 09:42",
    eleve: "Kouassi Jean",
    classe: "6e A",
    motif: "Tranche 2 scolarité",
    montant: "60 000 FCFA",
    mode: "Espèces",
    caissier: "A. Koné",
  },
  {
    date: "14/03/2025 09:28",
    eleve: "Aminata Traoré",
    classe: "Terminale D",
    motif: "Inscription",
    montant: "45 000 FCFA",
    mode: "Orange Money",
    caissier: "A. Koné",
  },
  {
    date: "14/03/2025 09:10",
    eleve: "Yao Eric",
    classe: "4e B",
    motif: "Frais d’examen BEPC",
    montant: "12 500 FCFA",
    mode: "Wave",
    caissier: "M. Brou",
  },
  {
    date: "14/03/2025 08:55",
    eleve: "Diabaté Fatou",
    classe: "CM2",
    motif: "Tranche 3 scolarité",
    montant: "40 000 FCFA",
    mode: "Espèces",
    caissier: "A. Koné",
  },
  {
    date: "14/03/2025 08:31",
    eleve: "N’Guessan Paul",
    classe: "2nde C",
    motif: "Solde scolarité",
    montant: "75 000 FCFA",
    mode: "Chèque",
    caissier: "M. Brou",
  },
]

export function WfDashboard() {
  return (
    <MockAppShell activeKey="dashboard">
      <PageHeader
        title="Tableau de bord"
        description="Vue d’ensemble — Année 2024–2025 · 2ᵉ trimestre · Collège Le Chandelier"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Exporter
            </Button>
            <PrimaryButton size="sm">
              <Plus className="size-4" /> Encaissement
            </PrimaryButton>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total encaissé"
          value="15 240 000 FCFA"
          sub="+12 % vs 1ᵉʳ trimestre"
          tone="emerald"
          icon={Coins}
        />
        <KpiCard
          label="Total attendu"
          value="22 500 000 FCFA"
          sub="2ᵉ trimestre — toutes classes"
          tone="slate"
          icon={Wallet}
        />
        <KpiCard
          label="Taux de recouvrement"
          value="68 %"
          sub="Objectif : 80 %"
          tone="amber"
          icon={TrendingUp}
        />
        <KpiCard
          label="Impayés"
          value="7 260 000 FCFA"
          sub="142 élèves en retard"
          tone="rose"
          icon={AlertTriangle}
        />
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Encaissements par cycle (2ᵉ trimestre)</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBars
              data={[
                { label: "Préscolaire", value: 1.1, tone: "bg-emerald-300" },
                { label: "Primaire", value: 4.6, tone: "bg-emerald-500" },
                { label: "Collège", value: 6.2, tone: "bg-emerald-600" },
                { label: "Lycée", value: 3.3, tone: "bg-emerald-700" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition par mode</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <MiniDonut percent={58} label="Espèces 58 %" tone="#059669" />
            <div className="grid w-full grid-cols-2 gap-2 text-xs">
              <ModeRow color="#059669" label="Espèces" value="58 %" />
              <ModeRow color="#f59e0b" label="Orange Money" value="22 %" />
              <ModeRow color="#0ea5e9" label="Wave" value="12 %" />
              <ModeRow color="#64748b" label="Chèque / Virement" value="8 %" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent payments */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Paiements récents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / heure</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Caissier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((r) => (
                <TableRow key={r.date}>
                  <TableCell className="text-muted-foreground">{r.date}</TableCell>
                  <TableCell className="font-medium">{r.eleve}</TableCell>
                  <TableCell>{r.classe}</TableCell>
                  <TableCell>{r.motif}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {r.montant}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.mode}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.caissier}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>5 paiements sur 84 aujourd’hui</span>
            <span className="flex items-center gap-1 text-emerald-700">
              <ArrowUpRight className="size-3" /> +18 % vs hier
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <ArrowDownRight className="size-3" />
        Données mises à jour il y a 2 min — source : caisse &amp; Mobile Money.
      </div>
    </MockAppShell>
  )
}

function ModeRow({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 truncate text-slate-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
