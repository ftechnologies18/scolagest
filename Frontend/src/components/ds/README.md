# 🌿 Design System "Forêt EdTech"

Identité visuelle unifiée de ScolaGest — palette africaine (emerald + amber + terracotta + gold + forest), motif kente, glassmorphism adaptatif, animations Framer Motion.

> **Périmètre** : toutes les pages dashboard (staff, saas, prof, parent). Landing page (`/`) et login (`(auth)/*`) NON concernés (ils gardent leur style propre).

## 🎨 Palette

| Couleur | Hex | Usage |
|---|---|---|
| Forest | `#064E3B` | Fond sombre sidebar/topbar |
| Forest Deep | `#022C22` | Variante foncée |
| Emerald | `#047857` | Primaire (validation, succès) |
| Amber | `#F59E0B` | Secondaire (warnings, accents) |
| Gold | `#D4AF37` | Premium (abonnements, bordures) |
| Terracotta | `#C2410C` | Danger warm (suppressions) |
| Sand | `#FEF3C7` | Backgrounds subtils |

## 🪡 Motif Kente

Motif décoratif africain (diamants + chevrons). Usage strict :
- **Header strip** : `<KentePattern variant="strip" position="top" />` (h-1)
- **Footer strip** : `<KentePattern variant="strip" position="bottom" />` (h-1.5)
- **Background subtil** : `<KentePattern variant="bg" />` (opacity 10%)
- **Séparateur** : `<KentePattern variant="separator" />` (ligne or)
- **Bordure premium** : `<GlassCard premiumBorder>` (border gold)

⚠️ **Jamais** en fond de texte. **Jamais** opacity > 15% en bg.

## 🧊 Glassmorphism adaptatif

| Breakpoint | Classe | Opacité | Blur |
|---|---|---|---|
| Mobile (<768px) | `.glass-mobile` | 70% | 20px |
| Tablette (768-1023px) | `.glass-tablet` | 80% | 16px |
| Desktop (1024px+) | `.glass-desktop` | 85% | 12px |
| Premium | `.glass-premium` | forêt sombre | 16px + bordure gold |
| Dark (chrome) | `.glass-dark` | forêt 95% | 16px |
| Responsive | `.glass-adaptive` | auto | auto |

→ `<GlassCard variant="adaptive">` gère tout automatiquement.

## 🧩 Composants

### Primitives
- `<Button variant="success|premium|terracotta|gold|forest">` — boutons Forêt EdTech (fe-2a)
- `<GlassCard variant="adaptive|mobile|tablet|desktop|premium" premiumBorder delay>` — carte glass (fe-2b)
- `<KentePattern variant="strip|bg|border|separator" position="top|bottom|custom">` — motif kente (fe-2c)
- `<ProgressCircle value={75} size={120}>` — cercle animé gradient emerald→amber (fe-2c)
- `<StatCard icon={Wallet} label="Total" value="1.2M FCFA" tone="emerald" trend={12.5}>` — KPI carte (fe-2d)

### Hooks
- `useMediaQuery(query)` — responsive générique SSR-safe
- `useIsMobile()` / `useIsTablet()` / `useIsDesktop()` — presets
- `usePrefersReducedMotion()` — a11y animations

### Animations (`@/lib/animations`)
- `pageTransition` — transition de page
- `staggerContainer` / `staggerItem` — listes animées
- `cardHover` (y: -2) / `buttonHover` (scale: 1.02) / `buttonTap` (scale: 0.98)
- `fadeInUp` / `scaleIn` / `slideInLeft` / `slideInRight`
- `getMotion(prefersReducedMotion)` — variants "off" si a11y

## 🔤 Typographie

- **Titres** : `font-display` (Poppins 500-800)
- **Corps** : `font-body` (Inter 400-700)
- Landing/login : Geist (inchangé)

## ✅ Règles strictes

1. Aucune couleur hors tokens (pas de blue/indigo)
2. Glassmorphism desktop : contraste WCAG AA (texte foncé sur blanc 85%)
3. Kente : accent strict, jamais fond de texte
4. Animations : respecter `prefers-reduced-motion`
5. Touch targets ≥ 44px sur mobile
6. Radius : `rounded-2xl` (cartes), `rounded-lg` (boutons/inputs)
7. Shadows : utiliser les tokens (`shadow-glass`, `shadow-emerald`, etc.)

## 📐 Exemples

### Carte statistique
(voir ci-dessus StatCard)

### Dashboard layout type
```tsx
<div className="min-h-screen flex flex-col">
  <KentePattern variant="strip" position="top" />
  <DashboardShell> {/* sidebar + topbar dark "Forêt" */}
    <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Encaissé" value="1.2M" tone="emerald" trend={12.5} delay={0} />
        <StatCard icon={Users} label="Élèves" value="847" tone="amber" trend={3.2} delay={0.05} />
        ...
      </div>
      <div className="grid gap-4 md:gap-6 mt-6 grid-cols-1 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">{/* Chart */}</GlassCard>
        <GlassCard variant="premium">{/* Premium card */}</GlassCard>
      </div>
    </main>
  </DashboardShell>
  <footer className="mt-auto">...</footer>
  <KentePattern variant="strip" position="bottom" />
</div>
```

## 🚀 Roadmap

- ✅ Phase 1 : tokens, hooks, animations, fonts
- ✅ Phase 2 : primitives (Button, GlassCard, KentePattern, ProgressCircle, StatCard)
- ⏳ Phase 3 : chrome (sidebar/topbar Forêt) + layouts scoped
- ⏳ Phase 4 : dashboard home vitrine
- ⏳ Phase 5 : migration vues (caisse, eleves, rapports)
- ⏳ Phase 6 : audit a11y + polish

---

*Forêt EdTech Design System — Freelance Technologies Côte d'Ivoire © 2026*
