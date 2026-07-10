import {
  Plus,
  ShieldCheck,
  Building2,
  Lock,
  MoreHorizontal,
  Check,
  Minus,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
  AnnotationBadge,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const users = [
  { nom: "Koffi Marc", email: "mkoffi@lechandelier.ci", role: "Administrateur", sites: "Tous", statut: "Actif" },
  { nom: "Awa Koné", email: "akone@lechandelier.ci", role: "Caissier", sites: "Le Chandelier", statut: "Actif" },
  { nom: "Mariam Brou", email: "mbrou@lechandelier.ci", role: "Caissier", sites: "Le Chandelier", statut: "Actif" },
  { nom: "Yves Tanoh", email: "ytanoh@lechandelier.ci", role: "Caissier", sites: "Annexe Dabou", statut: "Actif" },
  { nom: "Dr. Adjoua", email: "cadjoua@lechandelier.ci", role: "Direction", sites: "Tous", statut: "Actif" },
  { nom: "Censeur 1", email: "censeur@lechandelier.ci", role: "Censeur", sites: "Le Chandelier", statut: "Suspendu" },
]

const roles = [
  "Administrateur",
  "Caissier",
  "Comptable",
  "Direction",
  "Censeur",
  "Secrétariat",
  "Parent",
]

const perms = [
  { module: "Élèves", admin: "full", caissier: "view", direction: "full", censeur: "full", secretaire: "edit" },
  { module: "Caisse — encaissement", admin: "full", caissier: "full", direction: "view", censeur: "none", secretaire: "none" },
  { module: "Reçus", admin: "full", caissier: "full", direction: "view", censeur: "view", secretaire: "view" },
  { module: "Frais & échéanciers", admin: "full", caissier: "none", direction: "view", censeur: "none", secretaire: "none" },
  { module: "Rapports", admin: "full", caissier: "view", direction: "full", censeur: "view", secretaire: "none" },
  { module: "Comptabilité", admin: "full", caissier: "none", direction: "full", censeur: "none", secretaire: "none" },
  { module: "Utilisateurs & rôles", admin: "full", caissier: "none", direction: "view", censeur: "none", secretaire: "none" },
]

export function WfUserManagement() {
  return (
    <MockAppShell activeKey="users">
      <PageHeader
        title="Utilisateurs & rôles"
        description="Gestion des comptes, des rôles RBAC et du périmètre par établissement."
        actions={
          <>
            <Button variant="outline" size="sm">
              <ShieldCheck className="size-4" /> Rôles
            </Button>
            <PrimaryButton size="sm">
              <Plus className="size-4" /> Nouvel utilisateur
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AnnotationBadge tone="emerald">Multi-sites</AnnotationBadge>
        <AnnotationBadge tone="slate">RBAC</AnnotationBadge>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Rôle</label>
            <StaticSelect value="Tous les rôles" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Établissement</label>
            <StaticSelect value="Tous" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Statut</label>
            <StaticSelect value="Tous" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Recherche</label>
            <input
              className="h-9 w-full rounded-md border bg-white px-3 text-sm shadow-xs"
              placeholder="nom ou e-mail…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Utilisateurs — 6 comptes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3.5" /> Établissement
                  </span>
                </TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.email}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar>
                        <AvatarFallback className="bg-emerald-100 text-xs text-emerald-700">
                          {u.nom
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{u.nom}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.sites}</TableCell>
                  <TableCell>
                    {u.statut === "Actif" ? (
                      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                        Actif
                      </Badge>
                    ) : (
                      <Badge className="border-rose-300 bg-rose-100 text-rose-800">
                        Suspendu
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                      <Lock className="size-3.5" /> Activée
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-7">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permissions matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" /> Matrice de permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">Module</th>
                {roles.slice(0, 5).map((r) => (
                  <th key={r} className="px-2 py-2 text-center">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p.module} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">{p.module}</td>
                  {[p.admin, p.caissier, p.direction, p.censeur, p.secretaire].map(
                    (lvl, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        <PermCell level={lvl} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="size-3 text-emerald-600" /> Plein accès
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-400" /> Lecture seule
            </span>
            <span className="flex items-center gap-1">
              <Minus className="size-3 text-slate-400" /> Aucun accès
            </span>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Switch defaultChecked id="enforce-rbac" />
            <label htmlFor="enforce-rbac" className="text-xs">
              Appliquer strictement le RBAC (recommandé)
            </label>
          </div>
        </CardContent>
      </Card>
    </MockAppShell>
  )
}

function PermCell({ level }: { level: string }) {
  if (level === "full") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        <Check className="size-3" /> Plein
      </span>
    )
  }
  if (level === "edit") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        Édition
      </span>
    )
  }
  if (level === "view") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
        Lecture
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center text-slate-300">
      <Minus className="size-4" />
    </span>
  )
}
