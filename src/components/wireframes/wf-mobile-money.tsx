import {
  Smartphone,
  Webhook,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
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

const txns = [
  { id: "OM-99887766", eleve: "Aminata Traoré", montant: "45 000", provider: "Orange Money", statut: "Réconcilié", heure: "09:28" },
  { id: "WV-552301", eleve: "Yao Eric", montant: "12 500", provider: "Wave", statut: "En attente", heure: "09:10" },
  { id: "MT-448812", eleve: "Diabaté Fatou", montant: "40 000", provider: "MTN Money", statut: "Réconcilié", heure: "08:55" },
  { id: "OM-99880012", eleve: "Bamba Awa", montant: "30 000", provider: "Orange Money", statut: "Échec", heure: "08:31" },
  { id: "WV-551102", eleve: "Konan Yves", montant: "60 000", provider: "Wave", statut: "Réconcilié", heure: "08:12" },
]

const webhooks = [
  { event: "payment.success", id: "OM-99887766", time: "09:28:14", statut: "200 OK" },
  { event: "payment.success", id: "WV-552301", time: "09:10:42", statut: "200 OK" },
  { event: "payment.failed", id: "OM-99880012", time: "08:31:09", statut: "200 OK" },
  { event: "payment.pending", id: "MT-448812", time: "08:55:01", statut: "200 OK" },
]

export function WfMobileMoney() {
  return (
    <MockAppShell activeKey="momo">
      <PageHeader
        title="Mobile Money"
        description="Intégration Orange Money, MTN Money et Wave — suivi & réconciliation."
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCw className="size-4" /> Synchroniser
            </Button>
            <PrimaryButton size="sm">
              <Plus className="size-4" /> Nouvelle transaction
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AnnotationBadge tone="amber">V1 étendu — Mobile Money</AnnotationBadge>
        <AnnotationBadge tone="emerald">Multi-sites</AnnotationBadge>
      </div>

      {/* Providers */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <ProviderCard name="Orange Money" balance="2 480 000 F" tone="bg-orange-500" connected />
        <ProviderCard name="MTN Money" balance="1 120 000 F" tone="bg-yellow-400" connected />
        <ProviderCard name="Wave" balance="1 980 000 F" tone="bg-sky-500" connected />
      </div>

      {/* KPI */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Encaissé Momo (jour)" value="1 760 000 F" tone="emerald" icon={Smartphone} />
        <KpiCard label="Transactions" value="38" tone="slate" />
        <KpiCard label="En attente" value="3" tone="amber" icon={Clock} />
        <KpiCard label="Échecs" value="2" tone="rose" icon={XCircle} />
      </div>

      <Tabs defaultValue="txns">
        <TabsList>
          <TabsTrigger value="txns">Transactions</TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="size-4" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="recon">Réconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="txns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Transactions Mobile Money</CardTitle>
              <StaticSelect value="Tous les providers" className="w-48" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Heure</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">{t.heure}</TableCell>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell className="font-medium">{t.eleve}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {t.montant} F
                      </TableCell>
                      <TableCell>
                        {t.statut === "Réconcilié" && (
                          <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="size-3" /> Réconcilié
                          </Badge>
                        )}
                        {t.statut === "En attente" && (
                          <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                            <Clock className="size-3" /> En attente
                          </Badge>
                        )}
                        {t.statut === "Échec" && (
                          <Badge className="border-rose-300 bg-rose-100 text-rose-800">
                            <XCircle className="size-3" /> Échec
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Journal des webhooks</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Heure</TableHead>
                    <TableHead>Événement</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut HTTP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((w) => (
                    <TableRow key={`${w.id}-${w.time}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {w.time}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                          {w.event}
                        </code>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{w.id}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-300 text-emerald-700"
                        >
                          {w.statut}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recon">
          <Card>
            <CardHeader>
              <CardTitle>Réconciliation automatique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Chaque transaction Momo reçue via webhook est automatiquement
                rapprochée d’un encaissement ScolaGest. Les écarts génèrent une
                alerte pour validation manuelle.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <KpiCard label="Rapprochées" value="35" tone="emerald" />
                <KpiCard label="À valider" value="3" tone="amber" />
                <KpiCard label="Écarts" value="0" tone="emerald" />
              </div>
              <div className="flex justify-end">
                <PrimaryButton>
                  <RefreshCw className="size-4" /> Lancer la réconciliation
                </PrimaryButton>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MockAppShell>
  )
}

function ProviderCard({
  name,
  balance,
  tone,
  connected,
}: {
  name: string
  balance: string
  tone: string
  connected?: boolean
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex size-8 items-center justify-center rounded-lg text-white ${tone}`}>
            <Smartphone className="size-4" />
          </span>
          <div>
            <div className="font-semibold">{name}</div>
            <div className="text-[11px] text-muted-foreground">Solde encaissé</div>
          </div>
        </div>
        {connected && (
          <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="size-3" /> Connecté
          </Badge>
        )}
      </div>
      <div className="mt-3 text-xl font-bold">{balance}</div>
    </div>
  )
}
