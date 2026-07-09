import {
  GraduationCap,
  Bell,
  Download,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Wallet,
  Receipt,
  CreditCard,
} from "lucide-react"
import { AnnotationBadge } from "./wf-shared"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const children = [
  {
    nom: "Kouassi Jean",
    classe: "6e A",
    solde: "120 000 F",
    statut: "À jour",
    prochain: "Tranche 4 — 15/05/2025",
    montant: "60 000 F",
  },
  {
    nom: "Kouassi Sarah",
    classe: "CM1",
    solde: "20 000 F",
    statut: "Partiel",
    prochain: "Tranche 3 — 31/03/2025",
    montant: "20 000 F",
  },
]

const payments = [
  { recu: "REC-2025-00184", date: "14/03/2025", eleve: "Kouassi Jean", motif: "Tranche 3 scolarité", montant: "60 000 F" },
  { recu: "REC-2025-00120", date: "08/02/2025", eleve: "Kouassi Jean", motif: "Tranche 2 scolarité", montant: "60 000 F" },
  { recu: "REC-2024-00890", date: "20/12/2024", eleve: "Kouassi Sarah", motif: "Inscription", montant: "30 000 F" },
]

export function WfParentPortal() {
  return (
    <div className="flex min-h-[660px] flex-col bg-slate-50 text-sm">
      {/* Top bar */}
      <header className="flex h-14 items-center gap-3 border-b bg-emerald-700 px-4 text-white">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">ScolaGest — Espace Parent</div>
            <div className="text-[11px] text-emerald-100">
              Collège Privé Le Chandelier
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Bell className="size-4" />
          <Avatar>
            <AvatarFallback className="bg-white text-emerald-700">MK</AvatarFallback>
          </Avatar>
          <div className="hidden text-right md:block">
            <div className="text-xs font-medium">Kouassi Marc</div>
            <div className="text-[10px] text-emerald-100">Parent — 2 enfants</div>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <div className="flex items-center gap-1 border-b bg-white px-4">
        <TabItem icon={GraduationCap} label="Mes enfants" active />
        <TabItem icon={Receipt} label="Paiements" />
        <TabItem icon={Download} label="Reçus" />
        <TabItem icon={CalendarClock} label="Échéances" />
      </div>

      <div className="flex-1 p-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-center gap-2">
            <AnnotationBadge tone="emerald">Portail parent</AnnotationBadge>
            <AnnotationBadge tone="amber">V1 étendu</AnnotationBadge>
          </div>

          {/* Children cards */}
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {children.map((c) => (
              <Card key={c.nom}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-lg font-bold text-emerald-700">
                      {c.nom
                        .split(" ")
                        .map((p) => p[0])
                        .join("")}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{c.nom}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.classe} · Année 2024–2025
                      </div>
                    </div>
                    {c.statut === "À jour" ? (
                      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="size-3" /> À jour
                      </Badge>
                    ) : (
                      <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                        <AlertTriangle className="size-3" /> Partiel
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-slate-50 px-2 py-1.5">
                      <div className="text-muted-foreground">Solde restant</div>
                      <div className="font-bold text-rose-700">{c.solde}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-1.5">
                      <div className="text-muted-foreground">Prochaine échéance</div>
                      <div className="font-semibold">{c.prochain}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span>
                      <CreditCard className="mr-1 inline size-3.5" />
                      Payer {c.montant} via Mobile Money
                    </span>
                    <ChevronRight className="size-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Upcoming échéances */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-emerald-600" /> Échéances à venir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Kouassi Sarah</TableCell>
                    <TableCell>Tranche 3 — 31/03/2025</TableCell>
                    <TableCell className="text-right font-semibold">20 000 F</TableCell>
                    <TableCell>
                      <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                        Bientôt
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Kouassi Jean</TableCell>
                    <TableCell>Tranche 4 — 15/05/2025</TableCell>
                    <TableCell className="text-right font-semibold">60 000 F</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-slate-600">
                        Planifiée
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4 text-emerald-600" /> Historique des paiements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reçu</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Reçu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.recu}>
                      <TableCell className="font-mono text-xs">{p.recu}</TableCell>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="font-medium">{p.eleve}</TableCell>
                      <TableCell>{p.motif}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">
                        {p.montant}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          <Download className="size-4" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function TabItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Bell
  label: string
  active?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm ${
        active
          ? "border-emerald-600 font-semibold text-emerald-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </div>
  )
}
