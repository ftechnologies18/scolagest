import { CheckCircle2, Lock, AlertTriangle, Banknote } from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
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

const cashiers = [
  { name: "Awa Koné", especes: "1 245 000", mobile: "860 000", cheque: "120 000", total: "2 225 000", ecart: "0" },
  { name: "Mariam Brou", especes: "980 000", mobile: "540 000", cheque: "0", total: "1 520 000", ecart: "0" },
  { name: "Yves Tanoh", especes: "745 000", mobile: "320 000", cheque: "75 000", total: "1 140 000", ecart: "+5 000" },
]

export function WfCashClosure() {
  return (
    <MockAppShell activeKey="closure">
      <PageHeader
        title="Clôture de caisse journalière"
        description="14/03/2025 — récapitulatif par caissier et validation."
        actions={
          <>
            <Button variant="outline" size="sm">
              Imprimer le Z de caisse
            </Button>
            <PrimaryButton size="sm">
              <Lock className="size-4" /> Clôturer la journée
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total théorique"
          value="4 885 000 F"
          sub="D’après les reçus émis"
          tone="slate"
          icon={Banknote}
        />
        <KpiCard
          label="Total remis (comptage)"
          value="4 890 000 F"
          sub="Espèces comptées"
          tone="emerald"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Écart"
          value="+5 000 F"
          sub="0,10 % — tolérance OK"
          tone="amber"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Reçus émis"
          value="84"
          sub="3 caissiers"
          tone="slate"
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Récapitulatif par caissier</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caissier</TableHead>
                <TableHead className="text-right">Espèces</TableHead>
                <TableHead className="text-right">Mobile Money</TableHead>
                <TableHead className="text-right">Chèques</TableHead>
                <TableHead className="text-right">Total théorique</TableHead>
                <TableHead className="text-right">Écart</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashiers.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.especes} F</TableCell>
                  <TableCell className="text-right">{c.mobile} F</TableCell>
                  <TableCell className="text-right">{c.cheque} F</TableCell>
                  <TableCell className="text-right font-semibold">
                    {c.total} F
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      c.ecart === "0" ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {c.ecart} F
                  </TableCell>
                  <TableCell>
                    {c.ecart === "0" ? (
                      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                        Conforme
                      </Badge>
                    ) : (
                      <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                        À justifier
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-[11px] uppercase text-muted-foreground">
                Espèces à remettre en banque
              </div>
              <div className="text-lg font-bold">2 970 000 F</div>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-[11px] uppercase text-muted-foreground">
                Mobile Money (à valider)
              </div>
              <div className="text-lg font-bold">1 720 000 F</div>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-[11px] uppercase text-muted-foreground">
                Chèques à encaisser
              </div>
              <div className="text-lg font-bold">195 000 F</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            La clôture verrouille définitivement la journée de caisse. Aucun
            encaissement ne pourra plus être ajouté pour le 14/03/2025.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="size-4" />
            Un écart de +5 000 FCFA est constaté pour Yves Tanoh — justification
            requise dans les observations.
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked
              className="accent-emerald-600"
              id="confirm"
            />
            <label htmlFor="confirm" className="text-xs">
              Je confirme avoir compté la caisse et je valide la clôture.
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline">Sauvegarder brouillon</Button>
            <PrimaryButton>
              <Lock className="size-4" /> Clôturer la journée
            </PrimaryButton>
          </div>
        </CardContent>
      </Card>
    </MockAppShell>
  )
}
