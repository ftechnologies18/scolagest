import {
  Mail,
  MessageSquare,
  FileText,
  Filter,
  Send,
  AlertTriangle,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  AccentButton,
  StaticSelect,
  KpiCard,
  AnnotationBadge,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const retards = [
  {
    eleve: "Aminata Traoré",
    classe: "Terminale D",
    echeance: "Tranche 2 — 15/12/2024",
    jours: 89,
    montant: "75 000",
    relance: "1ʳᵉ",
  },
  {
    eleve: "Bamba Awa",
    classe: "1ère A",
    echeance: "Tranche 1 — 15/09/2024",
    jours: 180,
    montant: "120 000",
    relance: "2ᵉ",
  },
  {
    eleve: "Cissé Ibrahim",
    classe: "5e B",
    echeance: "Tranche 2 — 15/12/2024",
    jours: 89,
    montant: "45 000",
    relance: "—",
  },
  {
    eleve: "Diallo Mariam",
    classe: "CM1",
    echeance: "Tranche 1 — 15/09/2024",
    jours: 180,
    montant: "30 000",
    relance: "1ʳᵉ",
  },
  {
    eleve: "Éboué Yann",
    classe: "2nde A",
    echeance: "Tranche 2 — 15/12/2024",
    jours: 89,
    montant: "75 000",
    relance: "—",
  },
]

export function WfOutstanding() {
  return (
    <MockAppShell activeKey="outstanding">
      <PageHeader
        title="Impayés & relances"
        description="Suivi des soldes en retard et génération des bordereaux de relance."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Filter className="size-4" /> Filtrer
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="size-4" /> Bordereau PDF
            </Button>
            <PrimaryButton size="sm">
              <Send className="size-4" /> Relancer (SMS/Email)
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AnnotationBadge tone="amber">V1 étendu — SMS/Email</AnnotationBadge>
        <AnnotationBadge tone="emerald">Multi-sites</AnnotationBadge>
      </div>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Élèves en retard"
          value="142"
          sub="22 % des effectifs"
          tone="rose"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Montant total impayé"
          value="7 260 000 F"
          sub="Toutes classes"
          tone="amber"
        />
        <KpiCard
          label="1ʳᵉ relance envoyée"
          value="98"
          sub="via SMS"
          tone="emerald"
          icon={MessageSquare}
        />
        <KpiCard
          label="2ᵉ relance envoyée"
          value="31"
          sub="via SMS + Email"
          tone="emerald"
          icon={Mail}
        />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-4 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Échéance</label>
            <StaticSelect value="Toutes" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Date limite</label>
            <StaticSelect value="Avant le 31/03/2025" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Cycle</label>
            <StaticSelect value="Tous" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Classe</label>
            <StaticSelect value="Toutes" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Niveau de relance
            </label>
            <StaticSelect value="Tous" />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Élèves en retard — sélection multiple</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox />
                </TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Jours de retard</TableHead>
                <TableHead className="text-right">Montant dû</TableHead>
                <TableHead>Relance</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retards.map((r) => (
                <TableRow key={r.eleve}>
                  <TableCell>
                    <Checkbox defaultChecked />
                  </TableCell>
                  <TableCell className="font-medium">{r.eleve}</TableCell>
                  <TableCell>{r.classe}</TableCell>
                  <TableCell className="text-muted-foreground">{r.echeance}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        r.jours > 120
                          ? "font-semibold text-rose-700"
                          : "font-semibold text-amber-700"
                      }
                    >
                      {r.jours} j
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {r.montant} F
                  </TableCell>
                  <TableCell>
                    {r.relance === "—" ? (
                      <Badge variant="outline" className="text-slate-500">
                        Aucune
                      </Badge>
                    ) : (
                      <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                        {r.relance}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" title="SMS">
                        <MessageSquare className="size-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" title="Email">
                        <Mail className="size-4 text-emerald-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-xs">
            <span>5 élèves sélectionnés — total : 345 000 FCFA</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <FileText className="size-4" /> Générer bordereau de relance
              </Button>
              <AccentButton size="sm">
                <Send className="size-4" /> Envoyer SMS + Email
              </AccentButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </MockAppShell>
  )
}
