import {
  Plus,
  Save,
  CalendarDays,
  Info,
  Copy,
  Pencil,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
  AnnotationBadge,
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

const fees = [
  { classe: "6e A", inscription: "45 000", sco: "5 × 60 000", examen: "—", total: "345 000" },
  { classe: "3e A", inscription: "45 000", sco: "5 × 60 000", examen: "12 500", total: "357 500" },
  { classe: "2nde C", inscription: "50 000", sco: "5 × 75 000", examen: "—", total: "425 000" },
  { classe: "Terminale D", inscription: "50 000", sco: "5 × 75 000", examen: "30 000", total: "455 000" },
  { classe: "CM2", inscription: "30 000", sco: "4 × 40 000", examen: "—", total: "190 000" },
]

const echeancier = [
  { tranche: "Tranche 1", date: "15/09/2024", montant: "60 000 FCFA", statut: "Clôturée" },
  { tranche: "Tranche 2", date: "15/12/2024", montant: "60 000 FCFA", statut: "Clôturée" },
  { tranche: "Tranche 3", date: "31/03/2025", montant: "60 000 FCFA", statut: "En cours" },
  { tranche: "Tranche 4", date: "15/05/2025", montant: "60 000 FCFA", statut: "À venir" },
  { tranche: "Tranche 5", date: "30/06/2025", montant: "60 000 FCFA", statut: "À venir" },
]

export function WfFeesConfig() {
  return (
    <MockAppShell activeKey="fees">
      <PageHeader
        title="Frais & échéanciers"
        description="Configuration des frais par année, cycle et classe."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Copy className="size-4" /> Dupliquer l’année
            </Button>
            <PrimaryButton size="sm">
              <Save className="size-4" /> Enregistrer
            </PrimaryButton>
          </>
        }
      />

      {/* Top selectors */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Année scolaire
            </label>
            <StaticSelect value="2024–2025" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Cycle</label>
            <StaticSelect value="Collège" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Établissement
            </label>
            <StaticSelect value="Collège Le Chandelier" />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <Info className="size-3.5" />
              5 tranches (collège/lycée) · 4 tranches (primaire/préscolaire)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fees table */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Grille des frais
            <AnnotationBadge tone="slate">Par catégorie</AnnotationBadge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classe</TableHead>
                <TableHead className="text-right">Inscription (affecté)</TableHead>
                <TableHead className="text-right">Inscription (non affecté)</TableHead>
                <TableHead>Scolarité</TableHead>
                <TableHead className="text-right">Examen</TableHead>
                <TableHead className="text-right">Total attendu</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((f) => (
                <TableRow key={f.classe}>
                  <TableCell className="font-medium">{f.classe}</TableCell>
                  <TableCell className="text-right">{f.inscription} F</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {Math.round(Number(f.inscription.replace(/\s/g, "")) * 1.15).toLocaleString("fr-FR")} F
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{f.sco}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{f.examen}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {f.total} F
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-7">
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" className="mt-3">
            <Plus className="size-4" /> Ajouter une classe
          </Button>
        </CardContent>
      </Card>

      {/* Échéancier editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-emerald-600" />
            Échéancier — Collège 6e (scolarité)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tranche</TableHead>
                <TableHead>Date limite</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Éditer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {echeancier.map((e) => (
                <TableRow key={e.tranche}>
                  <TableCell className="font-medium">{e.tranche}</TableCell>
                  <TableCell>
                    <Input defaultValue={e.date} className="h-8 w-36 text-xs" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      defaultValue={e.montant}
                      className="h-8 w-32 text-right text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        e.statut === "Clôturée"
                          ? "border-emerald-300 text-emerald-700"
                          : e.statut === "En cours"
                            ? "border-amber-300 text-amber-700"
                            : "border-slate-300 text-slate-600"
                      }
                    >
                      {e.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-7">
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MockAppShell>
  )
}
