import {
  BookOpen,
  ScrollText,
  Scale,
  Plus,
  Download,
  CheckCircle2,
  TrendingUp,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
  KpiCard,
  AnnotationBadge,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const journal = [
  { date: "14/03/2025", piece: "REC-2025-00185", compte: "511100 — Caisse", libelle: "Encaissement Kouassi Jean", debit: "60 000", credit: "—" },
  { date: "14/03/2025", piece: "REC-2025-00185", compte: "706100 — Scolarités", libelle: "Tranche 3 scolarité", debit: "—", credit: "60 000" },
  { date: "14/03/2025", piece: "REC-2025-00184", compte: "511100 — Caisse", libelle: "Encaissement A. Traoré", debit: "45 000", credit: "—" },
  { date: "14/03/2025", piece: "REC-2025-00184", compte: "706100 — Scolarités", libelle: "Inscription", debit: "—", credit: "45 000" },
  { date: "13/03/2025", piece: "OD-2025-0098", compte: "411000 — Clients (élèves)", libelle: "Relance impayés", debit: "7 260 000", credit: "—" },
]

const plan = [
  { code: "511100", libelle: "Caisse — espèces", classe: "5" },
  { code: "512100", libelle: "Banque BICICI", classe: "5" },
  { code: "511200", libelle: "Mobile Money", classe: "5" },
  { code: "411000", libelle: "Clients — élèves", classe: "4" },
  { code: "706100", libelle: "Scolarités", classe: "7" },
  { code: "706200", libelle: "Inscriptions", classe: "7" },
  { code: "706300", libelle: "Frais d’examen", classe: "7" },
]

export function WfAccounting() {
  return (
    <MockAppShell activeKey="accounting">
      <PageHeader
        title="Comptabilité générale"
        description="Plan comptable, journal des écritures, grand livre et bilan."
        actions={
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Exercice</span>
              <StaticSelect value="2024–2025" className="w-36" />
            </div>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export FEC
            </Button>
            <PrimaryButton size="sm">
              <Plus className="size-4" /> Écriture
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AnnotationBadge tone="amber">V1 étendu — Comptabilité</AnnotationBadge>
        <AnnotationBadge tone="emerald">Multi-sites</AnnotationBadge>
      </div>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Produits (exercice)" value="22 500 000 F" tone="emerald" icon={TrendingUp} />
        <KpiCard label="Clients (élèves)" value="7 260 000 F" tone="amber" />
        <KpiCard label="Trésorerie" value="12 480 000 F" tone="slate" />
        <KpiCard label="Résultat provisoire" value="3 220 000 F" tone="emerald" icon={CheckCircle2} />
      </div>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">
            <ScrollText className="size-4" /> Journal
          </TabsTrigger>
          <TabsTrigger value="plan">
            <BookOpen className="size-4" /> Plan comptable
          </TabsTrigger>
          <TabsTrigger value="livre">Grand livre</TabsTrigger>
          <TabsTrigger value="bilan">
            <Scale className="size-4" /> Bilan
          </TabsTrigger>
        </TabsList>

        {/* Journal */}
        <TabsContent value="journal">
          <Card>
            <CardHeader>
              <CardTitle>Journal des écritures — mars 2025</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Pièce</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journal.map((j, i) => (
                    <TableRow key={`${j.piece}-${i}`}>
                      <TableCell className="text-muted-foreground">{j.date}</TableCell>
                      <TableCell className="font-mono text-xs">{j.piece}</TableCell>
                      <TableCell className="font-mono text-xs">{j.compte}</TableCell>
                      <TableCell>{j.libelle}</TableCell>
                      <TableCell className="text-right">
                        {j.debit === "—" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="font-medium">{j.debit} F</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {j.credit === "—" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="font-medium text-emerald-700">{j.credit} F</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plan comptable */}
        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle>Plan comptable — OHADA adapté</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.map((p) => (
                    <TableRow key={p.code}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell>{p.libelle}</TableCell>
                      <TableCell>
                        <Badge variant="outline">Classe {p.classe}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(Math.random() * 5_000_000).toFixed(0)} F
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grand livre */}
        <TabsContent value="livre">
          <Card>
            <CardHeader>
              <CardTitle>Grand livre — 511100 — Caisse espèces</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-slate-50 p-4 text-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold">Compte 511100 — Caisse espèces</span>
                  <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                    Solde débiteur : 2 970 000 F
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Pièce</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="text-right">Débit</TableHead>
                      <TableHead className="text-right">Crédit</TableHead>
                      <TableHead className="text-right">Solde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>01/03/2025</TableCell>
                      <TableCell className="font-mono text-xs">Report</TableCell>
                      <TableCell className="text-muted-foreground">Solde reporté</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right font-medium">2 350 000 F</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>14/03/2025</TableCell>
                      <TableCell className="font-mono text-xs">REC-00185</TableCell>
                      <TableCell>Kouassi Jean — T3</TableCell>
                      <TableCell className="text-right">60 000 F</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right font-medium">2 410 000 F</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bilan */}
        <TabsContent value="bilan">
          <Card>
            <CardHeader>
              <CardTitle>Bilan résumé — 31/03/2025</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <BilanCol
                  title="Actif"
                  rows={[
                    { label: "Trésorerie (caisse + banque)", value: "12 480 000 F" },
                    { label: "Clients (élèves)", value: "7 260 000 F" },
                    { label: "Immobilisations", value: "45 000 000 F" },
                    { label: "Total actif", value: "64 740 000 F", bold: true },
                  ]}
                />
                <BilanCol
                  title="Passif"
                  rows={[
                    { label: "Capitaux propres", value: "52 000 000 F" },
                    { label: "Dettes fournisseurs", value: "9 520 000 F" },
                    { label: "Résultat de l’exercice", value: "3 220 000 F" },
                    { label: "Total passif", value: "64 740 000 F", bold: true },
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MockAppShell>
  )
}

function BilanCol({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: string; bold?: boolean }[]
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
        {title}
      </div>
      <div className="divide-y">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span className={r.bold ? "font-semibold" : "text-slate-600"}>
              {r.label}
            </span>
            <span className={r.bold ? "font-bold text-emerald-700" : "font-medium"}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
