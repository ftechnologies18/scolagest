import {
  GraduationCap,
  Lock,
  Mail,
  ChevronDown,
  ShieldCheck,
  Users,
  Banknote,
  Calculator,
  ClipboardList,
  Baby,
  UserCog,
} from "lucide-react"
import { AnnotationBadge, PrimaryButton } from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const roles = [
  { icon: ShieldCheck, label: "Administrateur" },
  { icon: Banknote, label: "Caissier" },
  { icon: Calculator, label: "Comptable / Direction" },
  { icon: ClipboardList, label: "Censeur" },
  { icon: UserCog, label: "Secrétariat" },
  { icon: Baby, label: "Parent" },
]

export function WfLogin() {
  return (
    <div className="flex min-h-[640px] flex-col md:flex-row">
      {/* Brand panel */}
      <div className="relative hidden flex-1 flex-col justify-between bg-gradient-to-br from-emerald-700 to-emerald-900 p-10 text-white md:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <div className="text-lg font-semibold">ScolaGest</div>
            <div className="text-xs text-emerald-100">
              Gestion scolaire &amp; caisse
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold leading-snug">
            Gérez vos élèves, vos frais et votre caisse — au même endroit.
          </h2>
          <p className="max-w-md text-sm text-emerald-100">
            Conçu pour le Collège Privé Le Chandelier à Dabou. Encaissements,
            reçus PDF, relances, Mobile Money et comptabilité intégrée.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <AnnotationBadge tone="emerald">Multi-sites</AnnotationBadge>
            <AnnotationBadge tone="emerald">Mobile Money</AnnotationBadge>
            <AnnotationBadge tone="emerald">Reçus PDF</AnnotationBadge>
          </div>
        </div>

        <div className="text-xs text-emerald-200">
          © 2025 ScolaGest — Collège Le Chandelier, Dabou (Côte d’Ivoire)
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="md:hidden">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <GraduationCap className="size-5" />
              </div>
              <div className="text-lg font-semibold">ScolaGest</div>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold">Connexion</h1>
            <p className="text-sm text-muted-foreground">
              Accédez à votre espace de gestion.
            </p>
          </div>

          {/* Establishment selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Établissement
            </label>
            <div className="flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 text-sm shadow-xs">
              <span className="truncate">Collège Privé Le Chandelier — Dabou</span>
              <ChevronDown className="size-4 opacity-50" />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Adresse e-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                defaultValue="mkoffi@lechandelier.ci"
                className="pl-8"
                placeholder="vous@etablissement.ci"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">
                Mot de passe
              </label>
              <a className="text-xs font-medium text-emerald-700 hover:underline">
                Mot de passe oublié ?
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                defaultValue="••••••••••"
                className="pl-8"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox defaultChecked id="remember" />
            <label htmlFor="remember" className="text-xs text-slate-600">
              Se souvenir de moi sur cet appareil
            </label>
          </div>

          <PrimaryButton className="w-full">Se connecter</PrimaryButton>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[10px] uppercase text-muted-foreground">
              Vous êtes ?
            </span>
            <Separator className="flex-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <div
                key={r.label}
                className="flex items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-xs text-slate-600"
              >
                <r.icon className="size-3.5 text-emerald-600" />
                <span className="truncate">{r.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>Nouvel utilisateur ?</span>
            <Button variant="link" className="h-auto p-0 text-emerald-700">
              Contacter l’administrateur
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
