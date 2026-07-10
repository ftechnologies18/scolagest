import { Search, Plus, Upload, Download, Filter, MoreHorizontal } from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
} from "./wf-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const students = [
  {
    matricule: "CI-00245-MEN",
    nom: "Kouassi Jean",
    classe: "6e A",
    cat: "Affecté",
    statut: "À jour",
    solde: "0 FCFA",
  },
  {
    matricule: "CI-00246-INT",
    nom: "Aminata Traoré",
    classe: "Terminale D",
    cat: "Non affecté",
    statut: "Impayé",
    solde: "75 000 FCFA",
  },
  {
    matricule: "CI-00247-MEN",
    nom: "Yao Eric",
    classe: "4e B",
    cat: "Affecté",
    statut: "À jour",
    solde: "0 FCFA",
  },
  {
    matricule: "CI-00248-MEN",
    nom: "Diabaté Fatou",
    classe: "CM2",
    cat: "Affecté",
    statut: "Partiel",
    solde: "20 000 FCFA",
  },
  {
    matricule: "CI-00249-INT",
    nom: "N’Guessan Paul",
    classe: "2nde C",
    cat: "Non affecté",
    statut: "À jour",
    solde: "0 FCFA",
  },
  {
    matricule: "CI-00250-MEN",
    nom: "Bamba Awa",
    classe: "1ère A",
    cat: "Affecté",
    statut: "Impayé",
    solde: "120 000 FCFA",
  },
  {
    matricule: "CI-00251-MEN",
    nom: "Konan Yves",
    classe: "3e A",
    cat: "Affecté",
    statut: "À jour",
    solde: "0 FCFA",
  },
]

const statutVariant: Record<string, string> = {
  "À jour": "border-emerald-300 bg-emerald-100 text-emerald-800",
  Impayé: "border-rose-300 bg-rose-100 text-rose-800",
  Partiel: "border-amber-300 bg-amber-100 text-amber-800",
}

const catVariant: Record<string, string> = {
  Affecté: "border-emerald-300 bg-emerald-50 text-emerald-700",
  "Non affecté": "border-slate-300 bg-slate-100 text-slate-700",
}

export function WfStudentsList() {
  return (
    <MockAppShell activeKey="students">
      <PageHeader
        title="Élèves"
        description="648 élèves inscrits — 612 affectés, 36 en attente d’affectation"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload className="size-4" /> Importer
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Exporter
            </Button>
            <PrimaryButton size="sm">
              <Plus className="size-4" /> Nouvel élève
            </PrimaryButton>
          </>
        }
      />

      {/* Multi-criteria search */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Nom / prénom</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="ex. Kouassi" className="h-9 pl-8" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Matricule</label>
              <Input placeholder="CI-00245" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Cycle</label>
              <StaticSelect value="Tous les cycles" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Classe</label>
              <StaticSelect value="Toutes les classes" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Catégorie</label>
              <StaticSelect value="Toutes" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Statut paiement</label>
              <StaticSelect value="Tous" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" className="text-slate-600">
              <Filter className="size-4" /> Filtres avancés
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Réinitialiser
              </Button>
              <PrimaryButton size="sm">
                <Search className="size-4" /> Rechercher
              </PrimaryButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>7 résultats affichés sur 648</span>
            <span>Tri : nom ↑</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom &amp; prénom</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Solde dû</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.matricule}>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {s.matricule}
                  </TableCell>
                  <TableCell className="font-medium">{s.nom}</TableCell>
                  <TableCell>{s.classe}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${catVariant[s.cat]}`}
                    >
                      {s.cat}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statutVariant[s.statut]}`}
                    >
                      {s.statut}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      s.solde === "0 FCFA" ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {s.solde}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm">
                        Voir
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Page 1 / 93</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled>
                Préc.
              </Button>
              <Button variant="outline" size="sm">
                1
              </Button>
              <Button variant="ghost" size="sm">
                2
              </Button>
              <Button variant="ghost" size="sm">
                3
              </Button>
              <Button variant="outline" size="sm">
                Suiv.
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </MockAppShell>
  )
}
