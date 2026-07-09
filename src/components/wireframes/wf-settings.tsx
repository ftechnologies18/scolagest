import {
  Building2,
  Plus,
  Network,
  MessageSquare,
  History,
  ChevronRight,
  ChevronDown,
  Smartphone,
  School,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  AnnotationBadge,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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

const sites = [
  { nom: "Collège Privé Le Chandelier", ville: "Dabou", cycles: "Préscolaire, Primaire, Collège, Lycée", effectifs: 648, principal: true },
  { nom: "Annexe — Quartier Trade", ville: "Dabou", cycles: "Primaire, Collège", effectifs: 184, principal: false },
]

const tree = [
  {
    cycle: "Préscolaire",
    classes: ["Petite section", "Moyenne section", "Grande section"],
  },
  {
    cycle: "Primaire",
    classes: ["CP", "CE1", "CE2", "CM1", "CM2"],
  },
  {
    cycle: "Collège",
    classes: ["6e A", "6e B", "5e A", "5e B", "4e A", "4e B", "3e A", "3e B"],
  },
  {
    cycle: "Lycée",
    classes: ["2nde A", "2nde C", "1ère A", "1ère C", "1ère D", "Terminale A", "Terminale C", "Terminale D"],
  },
]

const audit = [
  { user: "Koffi Marc", action: "Modification grille des frais — 6e A", time: "14/03/2025 09:12", ip: "192.168.1.34" },
  { user: "Awa Koné", action: "Encaissement REC-2025-00185", time: "14/03/2025 09:48", ip: "192.168.1.51" },
  { user: "Dr. Adjoua", action: "Validation clôture caisse 13/03", time: "14/03/2025 08:05", ip: "192.168.1.10" },
  { user: "Koffi Marc", action: "Création utilisateur « Yves Tanoh »", time: "13/03/2025 16:40", ip: "192.168.1.34" },
  { user: "Mariam Brou", action: "Annulation reçu REC-2025-00171", time: "13/03/2025 14:22", ip: "192.168.1.52" },
]

export function WfSettings() {
  return (
    <MockAppShell activeKey="settings">
      <PageHeader
        title="Paramètres"
        description="Établissements multi-sites, cycles/classes, providers et journal d’audit."
        actions={
          <PrimaryButton size="sm">
            <Plus className="size-4" /> Ajouter
          </PrimaryButton>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AnnotationBadge tone="emerald">Multi-sites</AnnotationBadge>
        <AnnotationBadge tone="amber">V1 étendu</AnnotationBadge>
      </div>

      <Tabs defaultValue="sites">
        <TabsList>
          <TabsTrigger value="sites">
            <Building2 className="size-4" /> Établissements
          </TabsTrigger>
          <TabsTrigger value="cycles">
            <Network className="size-4" /> Cycles &amp; classes
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Smartphone className="size-4" /> Providers
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="size-4" /> Audit
          </TabsTrigger>
        </TabsList>

        {/* Sites */}
        <TabsContent value="sites">
          <Card>
            <CardHeader>
              <CardTitle>Établissements (multi-sites)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sites.map((s) => (
                <div
                  key={s.nom}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <School className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      {s.nom}
                      {s.principal && (
                        <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                          Site principal
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.ville} · {s.cycles} · {s.effectifs} élèves
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Configurer
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="size-4" /> Ajouter un établissement
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cycles & classes */}
        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle>Arborescence cycles &amp; classes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {tree.map((t) => (
                <div key={t.cycle} className="rounded-md border">
                  <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
                    <ChevronDown className="size-4 text-muted-foreground" />
                    <span className="font-semibold">{t.cycle}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {t.classes.length} classes
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3">
                    {t.classes.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs hover:bg-emerald-50"
                      >
                        <ChevronRight className="size-3 text-muted-foreground" />
                        {c}
                      </span>
                    ))}
                    <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-emerald-50">
                      <Plus className="size-3" /> Ajouter
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Providers */}
        <TabsContent value="providers">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="size-4 text-emerald-600" /> Mobile Money
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <ProviderRow name="Orange Money" connected />
                <ProviderRow name="MTN Money" connected />
                <ProviderRow name="Wave" connected />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-emerald-600" /> SMS / Email
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <ProviderRow name="SMS Gateway (registre.ci)" connected />
                <ProviderRow name="SMTP — Le Chandelier" connected />
                <div className="rounded-md border bg-slate-50 p-3 text-xs text-muted-foreground">
                  Modèles disponibles : relance 1ʳᵉ, relance 2ᵉ, reçu de paiement,
                  convocation, rappel d’échéance.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Journal d’audit — 30 derniers jours</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Date / heure</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{a.user}</TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell className="text-muted-foreground">{a.time}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.ip}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MockAppShell>
  )
}

function ProviderRow({
  name,
  connected,
}: {
  name: string
  connected?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="font-medium">{name}</span>
      <div className="flex items-center gap-2">
        <Switch defaultChecked={connected} />
        {connected ? (
          <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
            Connecté
          </Badge>
        ) : (
          <Badge variant="secondary">Inactif</Badge>
        )}
      </div>
    </div>
  )
}
