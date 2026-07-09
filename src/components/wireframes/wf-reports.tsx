import { FileSpreadsheet, FileText, Filter, BarChart3 } from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
  KpiCard,
  MiniBars,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const rows = [
  { cycle: "Préscolaire", attendu: "1 350 000", encaisse: "1 100 000", taux: "81%", impayes: "250 000" },
  { cycle: "Primaire", attendu: "5 200 000", encaisse: "4 600 000", taux: "88%", impayes: "600 000" },
  { cycle: "Collège", attendu: "9 800 000", encaisse: "6 200 000", taux: "63%", impayes: "3 600 000" },
  { cycle: "Lycée", attendu: "6 150 000", encaisse: "3 340 000", taux: "54%", impayes: "2 810 000" },
]

export function WfReports() {
  return (
    <MockAppShell activeKey="reports">
      <PageHeader
        title="Rapports & exports"
        description="Analyse des encaissements et exports comptables."
        actions={
          <>
            <Button variant="outline" size="sm">
              <FileText className="size-4" /> Export PDF
            </Button>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="size-4" /> Export Excel
            </Button>
            <PrimaryButton size="sm">
              <Filter className="size-4" /> Appliquer
            </PrimaryButton>
          </>
        }
      />

      {/* Filter panel */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Filtres du rapport</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <FilterField label="Période du">
            <Input defaultValue="01/01/2025" className="h-9" />
          </FilterField>
          <FilterField label="Au">
            <Input defaultValue="31/03/2025" className="h-9" />
          </FilterField>
          <FilterField label="Cycle">
            <StaticSelect value="Tous" />
          </FilterField>
          <FilterField label="Classe">
            <StaticSelect value="Toutes" />
          </FilterField>
          <FilterField label="Catégorie">
            <StaticSelect value="Toutes" />
          </FilterField>
          <FilterField label="Mode">
            <StaticSelect value="Tous" />
          </FilterField>
          <FilterField label="Caissier">
            <StaticSelect value="Tous" />
          </FilterField>
          <FilterField label="Établissement">
            <StaticSelect value="Tous" />
          </FilterField>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Encaissé (période)" value="15 240 000 F" tone="emerald" />
        <KpiCard label="Attendu (période)" value="22 500 000 F" tone="slate" />
        <KpiCard label="Taux recouvrement" value="68 %" tone="amber" />
        <KpiCard label="Impayés" value="7 260 000 F" tone="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Summary table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Synthèse par cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead className="text-right">Attendu</TableHead>
                  <TableHead className="text-right">Encaissé</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead className="text-right">Impayés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.cycle}>
                    <TableCell className="font-medium">{r.cycle}</TableCell>
                    <TableCell className="text-right">{r.attendu} F</TableCell>
                    <TableCell className="text-right text-emerald-700">
                      {r.encaisse} F
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          Number(r.taux.replace("%", "")) >= 75
                            ? "border-emerald-300 text-emerald-700"
                            : "border-amber-300 text-amber-700"
                        }
                      >
                        {r.taux}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-rose-700">
                      {r.impayes} F
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Chart placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-emerald-600" /> Encaissements
              mensuels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBars
              data={[
                { label: "Jan", value: 4.8, tone: "bg-emerald-400" },
                { label: "Fév", value: 5.1, tone: "bg-emerald-500" },
                { label: "Mar", value: 5.3, tone: "bg-emerald-600" },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </MockAppShell>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}
