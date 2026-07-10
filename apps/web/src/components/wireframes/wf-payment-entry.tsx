import {
  Search,
  Banknote,
  CheckCircle2,
  Wallet,
  AlertTriangle,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
  FieldRow,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"

export function WfPaymentEntry() {
  return (
    <MockAppShell activeKey="cash">
      <PageHeader
        title="Caisse — Encaissement"
        description="Saisie rapide d’un paiement — caissier : Awa Koné"
        actions={
          <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
            Caisse ouverte · 14/03/2025
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: student search + selection */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>1. Élève</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nom, matricule ou téléphone…"
                  className="pl-8"
                  defaultValue="Kouassi"
                />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="rounded-md border bg-slate-50 px-2 py-1.5 hover:bg-slate-100">
                  Kouassi Jean — 6e A — CI-00245-MEN
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1.5 hover:bg-slate-100">
                  Kouassi Marc (tuteur) — +225 07 09…
                </div>
              </div>

              <Separator />

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">
                    KJ
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Kouassi Jean</div>
                    <div className="text-[11px] text-muted-foreground">
                      6e A · CI-00245-MEN · Affecté
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-white px-2 py-1.5">
                    <div className="text-muted-foreground">Attendu</div>
                    <div className="font-semibold">345 000 F</div>
                  </div>
                  <div className="rounded-md bg-white px-2 py-1.5">
                    <div className="text-muted-foreground">Payé</div>
                    <div className="font-semibold text-emerald-700">165 000 F</div>
                  </div>
                  <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-800">
                    <AlertTriangle className="mr-1 inline size-3.5" />
                    Solde dû : <span className="font-bold">180 000 F</span> — prochaine échéance 31/03
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mode paiement */}
          <Card>
            <CardHeader>
              <CardTitle>3. Mode de paiement</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup defaultValue="especes" className="grid grid-cols-2 gap-2">
                <ModeOption value="especes" label="Espèces" hint="Caisse principale" />
                <ModeOption value="orange" label="Orange Money" hint="Paiement mobile" />
                <ModeOption value="wave" label="Wave" hint="Paiement mobile" />
                <ModeOption value="mtn" label="MTN Money" hint="Paiement mobile" />
                <ModeOption value="cheque" label="Chèque" hint="Banque" />
                <ModeOption value="virement" label="Virement" hint="Banque" />
              </RadioGroup>

              <div className="mt-3 space-y-2">
                <FieldRow label="Référence (Mobile Money / chèque)">
                  <Input placeholder="ex. OM-998877 / CHQ-001245" />
                </FieldRow>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: motif + montant + preview */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>2. Motif &amp; montant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label="Motif">
                  <StaticSelect value="Tranche 3 scolarité" />
                </FieldRow>
                <FieldRow label="Échéance associée">
                  <StaticSelect value="31/03/2025" />
                </FieldRow>
              </div>
              <FieldRow label="Montant encaissé (FCFA)">
                <Input
                  type="text"
                  defaultValue="60 000"
                  className="text-lg font-semibold"
                />
              </FieldRow>
              <div className="grid grid-cols-3 gap-2">
                {[60000, 30000, 180000].map((v) => (
                  <Button key={v} variant="outline" size="sm">
                    {v.toLocaleString("fr-FR")} F
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4 text-emerald-600" /> Aperçu du solde
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">
                    Solde avant encaissement
                  </div>
                  <div className="font-semibold text-rose-700">180 000 F</div>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">
                    Montant encaissé
                  </div>
                  <div className="font-semibold text-emerald-700">60 000 F</div>
                </div>
                <div className="col-span-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="size-4" /> Solde restant après
                    </span>
                    <span className="text-lg font-bold text-emerald-800">
                      120 000 F
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>Reçu PDF généré automatiquement — numérotation : REC-2025-00185</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline">Annuler</Button>
                <PrimaryButton className="gap-2">
                  <Banknote className="size-4" /> Encaisser 60 000 FCFA
                </PrimaryButton>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MockAppShell>
  )
}

function ModeOption({
  value,
  label,
  hint,
}: {
  value: string
  label: string
  hint: string
}) {
  return (
    <Label
      htmlFor={`mode-${value}`}
      className="flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
    >
      <RadioGroupItem value={value} id={`mode-${value}`} />
      <div className="flex-1">
        <div className="font-medium leading-tight">{label}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
    </Label>
  )
}
