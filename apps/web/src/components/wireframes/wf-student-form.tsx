import {
  ArrowLeft,
  Save,
  Camera,
  Info,
  CalendarClock,
} from "lucide-react"
import {
  MockAppShell,
  PageHeader,
  PrimaryButton,
  StaticSelect,
  FieldRow,
  AnnotationBadge,
} from "./wf-shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function WfStudentForm() {
  return (
    <MockAppShell activeKey="students">
      <PageHeader
        title="Nouvel élève"
        description="Renseignez l’identité, le matricule, la classe et le tuteur."
        actions={
          <>
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4" /> Annuler
            </Button>
            <PrimaryButton size="sm">
              <Save className="size-4" /> Enregistrer l’élève
            </PrimaryButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Photo + catégorie */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Photo &amp; catégorie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-32 items-center justify-center rounded-xl bg-emerald-100 text-4xl font-bold text-emerald-700">
                KE
              </div>
              <Button variant="outline" size="sm">
                <Camera className="size-4" /> Téléverser une photo
              </Button>
            </div>

            <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-2 flex items-center gap-1.5 font-semibold">
                <Info className="size-3.5" /> Catégorie d’inscription
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2">
                  <input
                    type="radio"
                    name="cat"
                    defaultChecked
                    className="accent-emerald-600"
                  />
                  <span className="flex-1 text-sm font-medium">Affecté (ministère)</span>
                  <AnnotationBadge tone="emerald">MEN</AnnotationBadge>
                </label>
                <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2">
                  <input type="radio" name="cat" className="accent-emerald-600" />
                  <span className="flex-1 text-sm font-medium">Non affecté (interne)</span>
                  <AnnotationBadge tone="slate">Provisoire</AnnotationBadge>
                </label>
              </div>
              <p className="mt-2 text-[11px] text-amber-700">
                Matricule provisoire généré automatiquement jusqu’à réception du
                matricule MEN.
              </p>
            </div>

            {/* Dérogation */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Dérogation 3 tranches</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Autoriser un échéancier dérogatoire pour les affectés.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identity + scolarité + tuteur */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Identité</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <FieldRow label="Nom *">
                <Input defaultValue="Kouassi" />
              </FieldRow>
              <FieldRow label="Prénom(s) *">
                <Input defaultValue="Eric" />
              </FieldRow>
              <FieldRow label="Sexe">
                <StaticSelect value="Masculin" />
              </FieldRow>
              <FieldRow label="Date de naissance">
                <Input type="text" defaultValue="12/04/2008" />
              </FieldRow>
              <FieldRow label="Lieu de naissance">
                <Input defaultValue="Dabou" />
              </FieldRow>
              <FieldRow label="Nationalité">
                <StaticSelect value="Ivoirienne" />
              </FieldRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matricule &amp; scolarité</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <FieldRow label="Matricule MEN">
                <Input placeholder="CI-00245-MEN" />
              </FieldRow>
              <FieldRow label="Matricule interne (auto)">
                <Input defaultValue="INT-2025-00251" disabled className="bg-slate-50" />
              </FieldRow>
              <FieldRow label="Année scolaire">
                <StaticSelect value="2024–2025" />
              </FieldRow>
              <FieldRow label="Cycle">
                <StaticSelect value="Collège" />
              </FieldRow>
              <FieldRow label="Classe">
                <StaticSelect value="6e A" />
              </FieldRow>
              <FieldRow label="Statut">
                <StaticSelect value="Inscrit" />
              </FieldRow>
              <FieldRow label="Date d’inscription">
                <Input type="text" defaultValue="15/09/2024" />
              </FieldRow>
              <FieldRow label="Régime / internat">
                <StaticSelect value="Externe" />
              </FieldRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tuteur / Parent</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <FieldRow label="Nom du tuteur *">
                <Input defaultValue="Kouassi Marc" />
              </FieldRow>
              <FieldRow label="Lien de parenté">
                <StaticSelect value="Père" />
              </FieldRow>
              <FieldRow label="Téléphone *">
                <Input defaultValue="+225 07 09 45 12 88" />
              </FieldRow>
              <FieldRow label="E-mail">
                <Input defaultValue="marc.kouassi@gmail.com" />
              </FieldRow>
              <FieldRow label="Adresse">
                <Input defaultValue="Quartier Résidentiel, Dabou" />
              </FieldRow>
              <FieldRow label="Profession">
                <Input defaultValue="Commerçant" />
              </FieldRow>
              <div className="md:col-span-2">
                <FieldRow label="Observations">
                  <Textarea placeholder="Allergies, informations particulières…" />
                </FieldRow>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CalendarClock className="size-4" />
            Échéancier par défaut : 5 tranches (collège/lycée). Dérogation 3
            tranches activée — voir l’onglet « Frais &amp; échéanciers ».
          </div>
        </div>
      </div>
    </MockAppShell>
  )
}
