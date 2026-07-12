# 🌿 Design System "Forêt EdTech"

Identité visuelle unifiée de ScolaGest — palette africaine (forest + emerald + amber + gold + terracotta), motif kente, glassmorphism adaptatif, animations Framer Motion, accessibilité WCAG AA.

> **Périmètre** : toutes les pages dashboard (staff, saas, prof, parent). Landing page (`/`) et login (`(auth)/*`) NON concernés.

## 📋 Table des matières
1. [Palette](#-palette)
2. [Motif Kente](#-motif-kente)
3. [Glassmorphism adaptatif](#-glassmorphism-adaptatif)
4. [Typographie](#-typographie)
5. [Composants](#-composants)
6. [Hooks & Animations](#-hooks--animations)
7. [Accessibilité](#-accessibilité)
8. [Règles strictes](#-règles-strictes)
9. [Exemples](#-exemples)
10. [Roadmap](#-roadmap)
11. [Stats](#-stats)

## 🎨 Palette

Palette africaine "Forêt EdTech" — déclarée dans `globals.css` sous `:root` (thème Hybride : sidebar/topbar dark + contenu light). Tokens Tailwind 4 exposés via `@theme inline` (suffixe `-fe` pour `emerald`/`amber` afin d'éviter les collisions avec les palettes Tailwind par défaut ; `forest`/`gold`/`terracotta`/`sand` sans suffixe car pas de collision).

| Couleur | Token CSS | Hex | Usage |
|---|---|---|---|
| Forest | `--forest` | `#064E3B` | Fond sombre sidebar / topbar / premium dark |
| Forest Deep | `--forest-deep` | `#022C22` | Variante foncée (hover forest, gradients) |
| Emerald | `--emerald` | `#047857` | Primaire — validation, succès, CTA principal |
| Amber | `--amber` | `#F59E0B` | Secondaire — warnings, accents, CTA premium |
| Gold | `--gold` | `#D4AF37` | Premium — bordures, abonnements SaaS, kente |
| Gold Light | `--gold-light` | `#E5C158` | Variant clair gold (highlights) |
| Gold Dark | `--gold-dark` | `#B8941F` | Variant foncé gold (hover, text-gold-dark) |
| Terracotta | `--terracotta` | `#C2410C` | Danger warm — suppressions définitives |
| Terracotta Light | `--terracotta-light` | `#EA580C` | Hover terracotta |
| Terracotta Dark | `--terracotta-dark` | `#9A3412` | Variant foncé terracotta |
| Sand | `--sand` | `#FEF3C7` | Backgrounds subtils chauds |

**Dégradés** : `--gradient-emerald-amber` (135°), `--gradient-forest` (180°), `--gradient-warm` (135°), `--gradient-premium` (135°).

**Shadows** : `--shadow-glass`, `--shadow-glass-lg`, `--shadow-emerald`, `--shadow-amber`, `--shadow-gold`.

## 🪡 Motif Kente

Motif décoratif africain (diamants + chevrons + lignes verticales) implémenté en **data URIs SVG** dans `globals.css` (zéro requête réseau, scalable). Usage strict via le composant `<KentePattern>` :

- **Header strip** : `<KentePattern variant="strip" position="top" />` (h-1, gradient forest + overlay)
- **Footer strip** : `<KentePattern variant="strip" position="bottom" />` (h-1.5, gradient premium gold→amber)
- **Background subtil** : `<KentePattern variant="bg" />` (opacity 10%, `pointer-events-none`, `absolute inset-0`)
- **Séparateur de section** : `<KentePattern variant="separator" />` (ligne or horizontale dégradée)
- **Bordure premium** : `<GlassCard premiumBorder>` (border-image gold→amber via `.kente-border-premium`)

⚠️ **Règles strictes** :
- **Jamais** en fond de texte (lisibilité).
- **Jamais** opacity > 15% en background.
- Toujours `aria-hidden="true"` (le composant l'ajoute automatiquement).
- Le `variant="border"` est un alias interne du strip — préférer `premiumBorder` sur `<GlassCard>` pour les bordures premium.

## 🧊 Glassmorphism adaptatif

5 variants glassmorphism déclarés dans `globals.css` + 1 classe responsive unifiée. Consommés via `<GlassCard variant="...">` ou directement en className.

| Variant | Classe | Background | Blur | Border | Usage |
|---|---|---|---|---|---|
| Mobile | `.glass-mobile` | blanc 70% | 20px | gold 25% | Forcer niveau mobile (<768px) |
| Tablette | `.glass-tablet` | blanc 80% | 16px | gold 30% | Forcer niveau tablette (768–1023px) |
| Desktop | `.glass-desktop` | blanc 85% | 12px | emerald 15% | Forcer niveau desktop (≥1024px) — **WCAG AA** |
| Premium | `.glass-premium` | forêt sombre 95% | 16px | gold 40% (2px) | Cartes premium SaaS (abonnements, factures pro) |
| Dark (chrome) | `.glass-dark` | forêt 95% | 16px | blanc 10% | Sidebar / topbar chrome dark |
| **Responsive** | `.glass-adaptive` | auto (mobile→tablet→desktop) | auto | auto | **Défaut** — s'adapte via 3 media queries |

`<GlassCard variant="adaptive">` (défaut) gère tout automatiquement. Le glass desktop (85% blanc) garantit le contraste WCAG AA pour le texte foncé (`text-foreground` / `text-muted-foreground` shadcn) — ratio ≥ 4.5:1.

## 🔤 Typographie

Polices chargées via `next/font/google` dans `app/layout.tsx` et injectées sur `<body>` en variables CSS :

- **Titres** : `.font-display` → **Poppins** (500–800) — headings, KPIs, libellés importants
- **Corps** : `.font-body` → **Inter** (400–700) — texte courant dashboard
- **Landing / login** : Geist Sans/Mono (inchangé, via `--font-geist-sans` / `--font-geist-mono`)

Fallbacks déclarés dans `globals.css` (`var(--font-display, "Poppins", sans-serif)`) pour éviter un font-family vide en SSR / mode dégradé.

## 🧩 Composants

### Primitives (`src/components/ds/`)

#### `<Button>` — 11 variants + 5 tailles
Composant shadcn étendu avec 5 variants "Forêt EdTech" :

| Variants shadcn (6) | Variants Forêt (5) |
|---|---|
| `default` · `destructive` · `outline` · `secondary` · `ghost` · `link` | `success` (gradient emerald) · `premium` (gradient amber) · `terracotta` (danger warm) · `gold` (CTA or plein) · `forest` (vert forêt profond) |

Tailles : `sm` (h-8) · `default` (h-9) · `lg` (h-10) · `xl` (h-12, CTA principaux) · `icon` (size-9 = 36px, AA OK).

#### `<GlassCard>` — 5 variants + options + **keyboard-accessible**
Carte glassmorphism basée sur `motion.div` (Framer Motion). Props :

- `variant` : `adaptive` (défaut) · `mobile` · `tablet` · `desktop` · `premium`
- `premiumBorder` : bordure gold→amber par-dessus le glass
- `noAnimation` : désactive l'animation d'entrée (listes / loops)
- `noHover` : désactive le hover lift (cartes non-interactives)
- `delay` : délai animation (secondes, pour stagger)
- **Si `onClick` passé** → carte devient **keyboard-accessible** :
  - `role="button"` + `tabIndex={0}`
  - `cursor-pointer` + `focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background`
  - `onKeyDown` handler : déclenche `click()` sur **Entrée** ou **Espace** (pattern button ARIA)
  - Merge l'éventuel `onKeyDown` consumer, respecte `e.defaultPrevented`

Respecte `prefers-reduced-motion` via `usePrefersReducedMotion` + `getMotion()`.

#### `<KentePattern>` — 4 variants × 3 positions
- `variant` : `strip` (défaut) · `bg` · `border` · `separator`
- `position` : `top` (h-1) · `bottom` (h-1.5) · `custom`
- Toujours `aria-hidden="true"` (décoratif)

#### `<ProgressCircle>` — SVG animé gradient emerald→amber
- `value` (0–100) · `size` (défaut 120px) · `strokeWidth` (défaut 10) · `label` (défaut "{value}%") · `trackColor`
- Stroke dégradé emerald `#047857` → amber `#F59E0B` via `<linearGradient>` + `React.useId()` (IDs uniques)
- Animation `motion.circle` 1.5s easeInOut (dashoffset)
- Respecte `prefers-reduced-motion` : si reduce, valeur affichée immédiatement (duration 0)

#### `<StatCard>` — 6 tones + trend + cliqueable + **aria-label auto**
- `icon` (Lucide) · `label` · `value` · `tone` : `emerald` · `amber` · `terracotta` · `gold` · `sky` · `forest`
- `trend` (numérique, ex: `12.5` = +12.5%) · `invertTrend` (ex: +impayés = mauvais) · `hint` (sous-titre) · `delay`
- `onClick` → passe la main à `<GlassCard>` (keyboard-accessible + ring focus)
- **Si `onClick` passé** → `aria-label={label}` automatique sur la `GlassCard` sous-jacente (le SR annonce « Total encaissé, bouton » au lieu de lire tout le contenu)
- Icônes décoratives `aria-hidden="true"`

### Chrome — `dashboard-shell.tsx`

Layout dashboard "Forêt" (sidebar + topbar + footer dark + contenu light) :

- **Sidebar dark `bg-forest`** — 3 modes persistés en localStorage :
  - **Étendu** (défaut desktop) : largeur 280px, labels complets
  - **Réduit** (toggle) : largeur 72px, icônes seules + tooltips
  - **Survol** : hover temporaire du mode réduit → expansion au survol
  - Groupes nav : **Pilotage**, **Configuration**, **Pédagogie**, **Modules avancés**
  - Footer sidebar : dropdown mode + bouton toggle + user menu trigger
- **Topbar dark `bg-forest/95 backdrop-blur-xl`** :
  - Hamburger mobile + bouton sidebar open (desktop)
  - Input recherche `aria-label="Recherche"` (placeholder "Rechercher…")
  - Bouton notifications avec pastille `animate-pulse` + dropdown
  - User menu trigger (avatar + nom + rôle)
- **Footer dark + bande kente** (gradient premium + overlay kente)
- **Badges temps réel** : caisse (encaissé du jour) + pré-inscriptions (en attente) — polling 30s via `useQuery` + `refetchInterval`

## 🪝 Hooks & Animations

### Hooks (`src/hooks/`)
- **`useMediaQuery(query)`** — responsive générique SSR-safe (retourne `false` en SSR, `useEffect` pour synchroniser)
- **`useIsMobile()`** / **`useIsTablet()`** / **`useIsDesktop()`** — presets (768px / 1024px)
- **`usePrefersReducedMotion()`** — `prefers-reduced-motion: reduce` (SSR-safe, écoute les changements OS en live)

### Animations (`src/lib/animations.ts`)
Variants Framer Motion réutilisables :

| Export | Usage |
|---|---|
| `pageTransition` | Transition de page (initial/animate/exit) |
| `staggerContainer` / `staggerItem` | Listes animées (children stagger) |
| `cardHover` | `whileHover: { y: -2 }` (cartes) |
| `buttonHover` / `buttonTap` | `scale: 1.02` / `scale: 0.98` (boutons) |
| `fadeInUp` | Fade + translate Y (16px) |
| `scaleIn` | Scale 0.95 → 1 |
| `slideInLeft` / `slideInRight` | Translate X (±20px) |
| `getMotion(prefersReducedMotion)` | Alias `m` — retourne `{ initial, animate, exit }` "off" si `prefersReducedMotion === true` |

## ♿ Accessibilité

Le DS "Forêt EdTech" vise **WCAG 2.1 AA**. Les points clés :

### Contraste WCAG AA
- **Sidebar / topbar dark `bg-forest #064E3B`** : utilise `text-emerald-100/80` (ratio ≈ 6.0:1 ✅) et `text-emerald-100/70` pour les sub-labels (ratio ≈ 4.7:1 ✅). Group labels sidebar (`PILOTAGE`, `CONFIGURATION`, etc.) en `text-emerald-100/70`.
- **GlassCard desktop** : blanc 85% + `text-foreground` / `text-muted-foreground` shadcn → ratio ≥ 4.6:1 ✅.
- **ProgressCircle** : `text-forest #064E3B` sur fond blanc → ratio ≈ 8.5:1 ✅.
- **Pas de `text-muted-foreground` shadcn sur fond dark** (gris par défaut pensé pour fond clair) — utiliser `text-emerald-100/80` à la place sur `bg-forest`.

### Focus visible
- **Nav items sidebar** : `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-forest` (anneau amber sur fond forest dark — on-brand et visible).
- **Boutons shadcn topbar** (hamburger, sidebar open, notif, recherche) : override `focus-visible:ring-amber-400/50 focus-visible:ring-offset-forest` (au lieu du ring gris shadcn par défaut).
- **GlassCard cliqueable** : `focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background` (anneau emerald sur fond light glass).

### `prefers-reduced-motion`
Deux mécanismes complémentaires :
1. **Hook `usePrefersReducedMotion()`** : gère les animations **Framer Motion** dans les primitives DS (GlassCard, ProgressCircle, StatCard) — désactive animations d'entrée / hover / stroke.
2. **Règle globale `@media (prefers-reduced-motion: reduce)` dans `globals.css`** : gère les animations **CSS utilitaires Tailwind** :
   - Désactive explicitement `.animate-pulse`, `.animate-spin`, `.animate-bounce`, `.animate-ping` (`animation: none !important`) — couvre pastille notif, Loader2 (~30 occurrences), Skeleton shadcn, ecran-pointage.
   - Règle universelle `*, *::before, *::after` : réduit `animation-duration` / `transition-duration` à `0.01ms`, force `animation-iteration-count: 1` + `scroll-behavior: auto`. Couvre drawers, modales, dropdowns, tooltips Radix sans les supprimer brutalement.

### Sémantique HTML / ARIA
- `KentePattern` → `aria-hidden="true"` (décoratif).
- Icônes Lucide décoratives dans boutons/labels → `aria-hidden="true"` (Building2, Search, ChevronDown, PanelLeftClose/Open, Menu, Bell, icônes nav).
- Boutons icon-only → `aria-label` obligatoire (hamburger `aria-label="Ouvrir le menu"`, sidebar open `aria-label="Ouvrir la sidebar"`, notif `aria-label="Notifications"`, toggle mode `aria-label="Basculer la sidebar"`, dropdown mode `aria-label="Mode d'affichage de la sidebar"`, user menu `aria-label="Menu utilisateur"`, recherche `aria-label="Recherche"`).
- `StatCard` avec `onClick` → `aria-label={label}` automatique sur la `GlassCard` sous-jacente.
- Landmarks : `<header>`, `<main>`, `<footer>`, `<nav>` (sidebar), `<aside>` (sidebar) ✅.

### Keyboard navigation
- **GlassCard cliqueable** : `role="button"` + `tabIndex={0}` + `onKeyDown` (Entrée / Espace déclenchent `click()`) — pattern button ARIA conforme.
- Tous les éléments interactifs (liens, boutons, inputs) sont focusables nativement ; la nav sidebar est entièrement parcourable au clavier.

### Touch targets (WCAG 2.2 SC 2.5.8)
- `Button size="icon"` = `size-9` = **36px** ✅ (au-dessus du minimum AA 24px, en-dessous du AAA 44px — acceptable).
- Nav items sidebar = **40px** de haut ✅.
- Toggle sidebar mode = 28px (desktop-only `lg:flex`) ✅.

## ✅ Règles strictes

1. **Aucune couleur hors tokens** — pas de `blue`, `indigo`, `violet`, etc. Palette Forêt uniquement (forest, emerald, amber, gold, terracotta, sand + variants).
2. **Glassmorphism desktop** : contraste WCAG AA (texte foncé sur blanc 85%). Jamais de texte clair sur glass clair.
3. **Kente** : accent strict. Jamais fond de texte. Jamais opacity > 15% en bg.
4. **Animations** : toujours respecter `prefers-reduced-motion` — utiliser `usePrefersReducedMotion()` pour Framer Motion, la règle globale `globals.css` gère les animations CSS Tailwind.
5. **Touch targets ≥ 36px** (AA) sur mobile. `Button size="icon"` = 36px ✅.
6. **Radius** : `rounded-2xl` (cartes / GlassCard), `rounded-lg` (boutons / inputs), `rounded-md` (petits éléments).
7. **Shadows** : utiliser les tokens (`shadow-glass`, `shadow-glass-lg`, `shadow-emerald`, `shadow-amber`, `shadow-gold`). Pas de shadow arbitraire.
8. **Focus** : toujours visible. `ring-amber-400/50` sur fond dark forest, `ring-emerald-500/50` sur fond light glass.
9. **Typographie** : `font-display` (Poppins) pour titres, `font-body` (Inter) pour corps. Geist réservé landing/login.
10. **Composants** : passer par le DS (`Button`, `GlassCard`, `StatCard`, `ProgressCircle`, `KentePattern`). Jamais de styles inline hors DS. Jamais dupliquer la logique glass/kente — utiliser les primitives.

## 📐 Exemples

### StatCard cliqueable avec aria-label auto
```tsx
import { Wallet, Users, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/ds/stat-card";

function DashboardKPIs() {
  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Wallet}
        label="Total encaissé"
        value="1 250 000 FCFA"
        tone="emerald"
        trend={12.5}
        delay={0}
        onClick={() => router.push("/caisse")}
      />
      <StatCard
        icon={AlertTriangle}
        label="Impayés"
        value="42"
        tone="terracotta"
        trend={5.2}
        invertTrend  // +impayés = mauvais → affiché en rouge
        delay={0.05}
      />
    </div>
  );
}
```

### GlassCard cliqueable (keyboard-accessible)
```tsx
import { GlassCard } from "@/components/ds/glass-card";

function SettingsCard() {
  return (
    <GlassCard
      onClick={() => setOpen(true)}
      className="hover:shadow-lg"
    >
      <h3 className="font-display text-lg">Paramètres généraux</h3>
      <p className="text-sm text-muted-foreground">Cliquez ou appuyez sur Entrée pour ouvrir</p>
    </GlassCard>
    // → role="button", tabIndex={0}, onKeyDown (Entrée/Espace), ring focus emerald
  );
}
```

### ProgressCircle (taux de recouvrement)
```tsx
import { ProgressCircle } from "@/components/ds/progress-circle";

function RecouvrementKPI({ taux }: { taux: number }) {
  return (
    <GlassCard className="flex flex-col items-center gap-4">
      <h3 className="font-display text-lg">Taux de recouvrement</h3>
      <ProgressCircle value={taux} size={140} />
      <p className="text-sm text-muted-foreground">Trimestre en cours</p>
    </GlassCard>
  );
}
```

### Layout dashboard type (chrome Forêt + KPIs + charts)
```tsx
import { KentePattern } from "@/components/ds/kente-pattern";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/ds/stat-card";
import { GlassCard } from "@/components/ds/glass-card";
import { Wallet, Users } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <KentePattern variant="strip" position="top" />
      <DashboardShell>  {/* sidebar dark + topbar dark + contenu light */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          {/* KPIs row */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Wallet} label="Encaissé" value="1.2M" tone="emerald" trend={12.5} delay={0} />
            <StatCard icon={Users} label="Élèves" value="847" tone="amber" trend={3.2} delay={0.05} />
            {/* ... */}
          </div>
          {/* Charts row */}
          <div className="grid gap-4 md:gap-6 mt-6 grid-cols-1 lg:grid-cols-3">
            <GlassCard className="lg:col-span-2">{/* Chart encaissements */}</GlassCard>
            <GlassCard variant="premium" premiumBorder>{/* Plan SaaS premium */}</GlassCard>
          </div>
        </main>
      </DashboardShell>
      <footer className="mt-auto bg-forest text-emerald-100/80 py-4">...</footer>
      <KentePattern variant="strip" position="bottom" />
    </div>
  );
}
```

## 🚀 Roadmap

| Phase | Contenu | Statut |
|---|---|---|
| **fe-1** | Tokens DS, hooks (`useMediaQuery`, `usePrefersReducedMotion`), animations (`@/lib/animations`), fonts Poppins/Inter | ✅ Terminé |
| **fe-2** | Primitives DS : `Button` (11 variants), `GlassCard`, `KentePattern`, `ProgressCircle`, `StatCard` | ✅ Terminé |
| **fe-3** | Chrome "Forêt" (sidebar dark 3 modes + topbar dark + footer kente) + layouts scoped (staff/saas/prof/parent) | ✅ Terminé |
| **fe-4** | Dashboard home vitrine (KPIs animés, charts, plans premium) | ✅ Terminé |
| **fe-5** | Migration 3 vues : caisse, eleves, rapports | ✅ Terminé |
| **fe-6a** | Audit accessibilité WCAG AA + corrections (contraste, focus, reduced-motion, sémantique, keyboard) | ✅ Terminé |
| **fe-6b** | README DS final (cette doc) | ✅ Terminé |

## 📊 Stats

| Métrique | Valeur |
|---|---|
| Primitives DS | **5** (Button, GlassCard, KentePattern, ProgressCircle, StatCard) |
| Variants Button | **11** (6 shadcn + 5 Forêt) |
| Tailles Button | **5** (sm, default, lg, xl, icon) |
| Variants GlassCard | **5** (mobile, tablet, desktop, premium, adaptive) |
| Variants KentePattern | **4** (strip, bg, border, separator) × 3 positions |
| Tones StatCard | **6** (emerald, amber, terracotta, gold, sky, forest) |
| Layouts scoped | **4** (staff, saas, prof, parent) |
| Vues migrées | **3** (caisse, eleves, rapports) |
| Couleurs hors palette | **0** indigo / blue |
| Conformité | **WCAG 2.1 AA** (contraste, focus, reduced-motion, keyboard, sémantique) |
| Polices DS | **2** (Poppins display, Inter body) + Geist landing/login |

---

*Forêt EdTech Design System — Freelance Technologies Côte d'Ivoire © 2026*
