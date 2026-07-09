import {
  Plus,
  CalendarDays,
  Archive,
  RefreshCw,
  CheckCircle2,
  GraduationCap,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
  KpiCard,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
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
import { Separator } from "@/components/ui/separator"

const years = [
  { year: "2024–2025", statut: "En cours", effectifs: 648, transition: "Réinscriptions ouvertes" },
  { year: "2023–2024", statut: "Clôturée", effectifs: 612, transition: "Archivée" },
  { year: "2022–2023", statut: "Archivée", effectifs: 580, transition: "Archivée" },
  { year: "2021–2022", statut: "Archivée", effectifs: 540, transition: "Archivée" },
]

export function WfSchoolYears() {
  return (
    <MockAppShell activeKey="years">
      <PageHeader
        title="Années scolaires"
        description="Création, réinscription, passage et archivage des exercices."
        actions={
          <PrimaryButton size="sm">
            <Plus className="size-4" /> Nouvelle année
          </PrimaryButton>
        }
      />

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Année courante" value="2024–2025" tone="emerald" icon={CalendarDays} />
        <KpiCard label="Effectifs" value="648" sub="612 affectés" tone="slate" icon={GraduationCap} />
        <KpiCard label="Réinscriptions" value="84 %" tone="amber" />
        <KpiCard label="Passages" value="562" sub="Promus — 86 refusés" tone="emerald" icon={CheckCircle2} />
      </div>

      {/* Years list */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Exercices scolaires</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Année</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Effectifs</TableHead>
                <TableHead>Transition</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.year}>
                  <TableCell className="font-semibold">{y.year}</TableCell>
                  <TableCell>
                    {y.statut === "En cours" && (
                      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                        En cours
                      </Badge>
                    )}
                    {y.statut === "Clôturée" && (
                      <Badge variant="outline" className="text-slate-600">
                        Clôturée
                      </Badge>
                    )}
                    {y.statut === "Archivée" && (
                      <Badge variant="secondary">Archivée</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{y.effectifs}</TableCell>
                  <TableCell className="text-muted-foreground">{y.transition}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {y.statut === "En cours" && (
                        <Button variant="outline" size="sm">
                          <RefreshCw className="size-4" /> Réinscrire
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-7">
                        <Archive className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create new year / passage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Créer une nouvelle année — 2025–2026</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500">
                  Libellé
                </label>
                <input
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm shadow-xs"
                  defaultValue="2025–2026"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500">
                  Date de rentrée
                </label>
                <input
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm shadow-xs"
                  defaultValue="15/09/2025"
                />
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <div className="mb-2 flex items-center gap-1.5 font-semibold">
                <RefreshCw className="size-3.5" /> Reprise des paramètres
              </div>
              <ul className="space-y-1">
                <li>✓ Grille des frais copiée depuis 2024–2025</li>
                <li>✓ Cycles &amp; classes copiés</li>
                <li>✓ Utilisateurs &amp; rôles conservés</li>
                <li>✓ Soldes impayés reportés (option)</li>
              </ul>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked
                className="accent-emerald-600"
                id="report-imp"
              />
              <label htmlFor="report-imp" className="text-xs">
                Reporter les impayés 2024–2025 sur 2025–2026
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline">Aperçu</Button>
              <PrimaryButton>
                <Plus className="size-4" /> Créer l’année
              </PrimaryButton>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processus de passage / réinscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">
                Année source
              </label>
              <StaticSelect value="2024–2025" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">
                Année destination
              </label>
              <StaticSelect value="2025–2026" />
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-emerald-50 p-2">
                <div className="text-lg font-bold text-emerald-700">562</div>
                <div className="text-muted-foreground">Promus</div>
              </div>
              <div className="rounded-md bg-amber-50 p-2">
                <div className="text-lg font-bold text-amber-700">86</div>
                <div className="text-muted-foreground">Redoublants</div>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-lg font-bold">648</div>
                <div className="text-muted-foreground">Total</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-xs">6ᵉ → 5ᵉ : 142 élèves</span>
                <Badge variant="outline" className="text-emerald-700">Automatique</Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-xs">Terminale → Diplômés : 96</span>
                <Badge variant="outline" className="text-slate-600">Sortants</Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-xs">CM2 → 6ᵉ : 78 (passage cycle)</span>
                <Badge variant="outline" className="text-amber-700">À valider</Badge>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline">Réviser</Button>
              <PrimaryButton>
                <CheckCircle2 className="size-4" /> Valider le passage
              </PrimaryButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </MockAppShell>
  )
}
