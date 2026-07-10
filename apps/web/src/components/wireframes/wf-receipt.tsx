import {
  Printer,
  Download,
  CheckCircle2,
  GraduationCap,
  QrCode,
} from "lucide-react"
import { MockAppShell, PrimaryButton } from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function WfReceipt() {
  return (
    <MockAppShell activeKey="receipts">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Encaissement réussi
            </h2>
            <p className="text-xs text-muted-foreground">
              Reçu généré et enregistré — disponible immédiatement pour impression.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="size-4" /> PDF
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="size-4" /> Imprimer
            </Button>
            <PrimaryButton size="sm">Nouvel encaissement</PrimaryButton>
          </div>
        </div>

        {/* Receipt */}
        <Card className="overflow-hidden">
          {/* Receipt header */}
          <div className="flex items-center justify-between bg-emerald-700 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-white/15">
                <GraduationCap className="size-6" />
              </div>
              <div>
                <div className="text-base font-semibold">Collège Privé Le Chandelier</div>
                <div className="text-[11px] text-emerald-100">
                  Dabou, Côte d’Ivoire · Tél : 27 23 78 00 00
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-emerald-100">
                Reçu de caisse
              </div>
              <div className="font-mono text-lg font-bold">N° REC-2025-00185</div>
            </div>
          </div>

          <CardContent className="space-y-4 p-6">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Meta label="Date" value="14/03/2025" />
              <Meta label="Heure" value="09:48" />
              <Meta label="Caissier" value="Awa Koné" />
              <Meta label="Caisse" value="Caisse #1" />
            </div>

            <Separator />

            {/* Student */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Élève</div>
                <div className="font-semibold">Kouassi Jean</div>
                <div className="text-xs text-muted-foreground">6e A · Collège</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Matricule</div>
                <div className="font-mono font-semibold">CI-00245-MEN</div>
                <div className="text-xs text-muted-foreground">Catégorie : Affecté</div>
              </div>
            </div>

            {/* Line items */}
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Désignation</th>
                    <th className="px-3 py-2 text-left">Échéance</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2">Tranche 3 — scolarité</td>
                    <td className="px-3 py-2 text-muted-foreground">31/03/2025</td>
                    <td className="px-3 py-2 text-right font-semibold">60 000 F</td>
                  </tr>
                </tbody>
                <tfoot className="bg-emerald-50">
                  <tr className="border-t">
                    <td className="px-3 py-2 font-semibold" colSpan={2}>
                      Total encaissé
                    </td>
                    <td className="px-3 py-2 text-right text-lg font-bold text-emerald-800">
                      60 000 FCFA
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment info */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3 text-sm">
                <div className="text-[11px] uppercase text-muted-foreground">
                  Mode de paiement
                </div>
                <div className="font-semibold">Espèces</div>
                <div className="text-xs text-muted-foreground">
                  Référence : —
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <div className="text-[11px] uppercase text-emerald-700">
                  Solde restant dû
                </div>
                <div className="text-lg font-bold text-emerald-800">120 000 FCFA</div>
                <div className="text-xs text-emerald-700">
                  Prochaine échéance : Tranche 4 — 15/05/2025
                </div>
              </div>
            </div>

            {/* Footer + QR */}
            <div className="flex items-end justify-between gap-4 pt-2">
              <div className="text-[11px] text-muted-foreground">
                <div>
                  Document généré électroniquement par ScolaGest — valable comme
                  reçu de caisse.
                </div>
                <div className="mt-1">
                  Vérifiable via le QR code avec le code vérification :
                  <span className="font-mono font-semibold"> SG-1A2B3C</span>
                </div>
                <div className="mt-2 italic">Merci de votre confiance.</div>
              </div>
              <div className="flex size-24 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
                <QrCode className="size-10" />
                <span className="text-[9px]">QR vérification</span>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Signé : Awa Koné (caissier)</span>
              <span>ScolaGest v1.0 · www.scolagest.ci</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </MockAppShell>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
