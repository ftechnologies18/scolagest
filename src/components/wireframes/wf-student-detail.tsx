import {
  ArrowLeft,
  Pencil,
  Printer,
  Plus,
  FileText,
  Phone,
  Mail,
  MapPin,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { MockAppShell, PrimaryButton } from "./wf-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const payments = [
  { recu: "REC-2025-00184", date: "14/03/2025", motif: "Tranche 2 scolarité", montant: "60 000 FCFA", mode: "Espèces" },
  { recu: "REC-2025-00120", date: "08/02/2025", motif: "Tranche 1 scolarité", montant: "60 000 FCFA", mode: "Orange Money" },
  { recu: "REC-2025-00045", date: "15/09/2024", motif: "Inscription", montant: "45 000 FCFA", mode: "Espèces" },
]

const documents = [
  { name: "Certificat de scolarité 2024-2025.pdf", size: "120 Ko" },
  { name: "Reçu inscription REC-2025-00045.pdf", size: "98 Ko" },
  { name: "Attestation de paiement.pdf", size: "115 Ko" },
]

export function WfStudentDetail() {
  return (
    <MockAppShell activeKey="students">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Kouassi Jean</h2>
              <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                Affecté
              </Badge>
              <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700">
                À jour
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Matricule MEN : CI-00245-MEN · Né le 12/04/2008
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Pencil className="size-4" /> Modifier
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="size-4" /> Certificat
          </Button>
          <PrimaryButton size="sm">
            <Plus className="size-4" /> Encaisser
          </PrimaryButton>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Identity card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-xl bg-emerald-100 text-2xl font-bold text-emerald-700">
                KJ
              </div>
              <div>
                <div className="font-semibold">Kouassi Jean</div>
                <div className="text-xs text-muted-foreground">
                  Sexe : M · 16 ans
                </div>
                <div className="text-xs text-muted-foreground">
                  Né à Dabou
                </div>
              </div>
            </div>
            <Separator />
            <InfoRow label="Matricule MEN" value="CI-00245-MEN" />
            <InfoRow label="Matricule interne" value="—" />
            <InfoRow label="Cycle / Classe" value="Collège · 6e A" />
            <InfoRow label="Année" value="2024–2025" />
            <InfoRow label="Catégorie" value="Affecté (ministère)" />
            <InfoRow label="Statut" value="Inscrit, à jour" />
            <InfoRow label="Date d’inscription" value="10/09/2024" />
          </CardContent>
        </Card>

        {/* Tuteur + solde */}
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tuteur / Parent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="font-medium">Kouassi Marc (père)</div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5" /> +225 07 09 45 12 88
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-3.5" /> marc.kouassi@gmail.com
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-3.5" /> Quartier Résidentiel, Dabou
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Solde &amp; scolarité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Total attendu
                  </span>
                  <span className="font-semibold">345 000 FCFA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Total payé
                  </span>
                  <span className="font-semibold text-emerald-700">
                    165 000 FCFA
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="size-4" /> Solde restant
                  </span>
                  <span className="text-lg font-bold text-emerald-800">
                    180 000 FCFA
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="size-3.5" />
                  Prochaine échéance : Tranche 3 — 31/03/2025 (60 000 FCFA)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment history */}
          <Card>
            <CardHeader>
              <CardTitle>Historique des paiements</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reçu</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Reçu PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.recu}>
                      <TableCell className="font-mono text-xs">{p.recu}</TableCell>
                      <TableCell>{p.date}</TableCell>
                      <TableCell>{p.motif}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.mode}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {p.montant}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="size-7">
                          <Download className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center gap-3 rounded-md border bg-white px-3 py-2"
                >
                  <FileText className="size-4 text-rose-600" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.size}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="size-4" /> Télécharger
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MockAppShell>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
