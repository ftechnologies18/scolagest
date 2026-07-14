"use client";

import Image from "next/image";
import Link from "next/link";
import {
  GraduationCap,
  Wallet,
  Receipt,
  Smartphone,
  BarChart3,
  ShieldCheck,
  Users,
  Building2,
  CheckCircle2,
  ArrowRight,
  Star,
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* ===== Navbar ===== */}
      <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="ScolaGest" width={36} height={36} className="rounded-lg" />
            <span className="text-lg font-bold text-gray-900">ScolaGest</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-emerald-600">Fonctionnalités</a>
            <a href="#solutions" className="text-sm font-medium text-gray-600 hover:text-emerald-600">Solutions</a>
            <a href="#testimonials" className="text-sm font-medium text-gray-600 hover:text-emerald-600">Témoignages</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-emerald-600">Tarifs</a>
            <a href="#faq" className="text-sm font-medium text-gray-600 hover:text-emerald-600">FAQ</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login">
              <Button variant="ghost" className="text-sm font-medium text-gray-700 hover:text-emerald-600">
                Espace Staff
              </Button>
            </Link>
            <Link href="/parent">
              <Button className="bg-amber-500 text-white hover:bg-amber-600">
                Espace Parent
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-4">
              <a href="#features" className="text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>Fonctionnalités</a>
              <a href="#solutions" className="text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
              <a href="#testimonials" className="text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>Témoignages</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>Tarifs</a>
              <a href="#faq" className="text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <div className="flex gap-2 pt-2">
                <Link href="/login"><Button variant="outline" className="flex-1">Espace Staff</Button></Link>
                <Link href="/parent"><Button className="flex-1 bg-amber-500 text-white hover:bg-amber-600">Espace Parent</Button></Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" style={{
          backgroundImage: "radial-gradient(circle, #05966920 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <Star className="mr-1 size-3.5" />
              Conçu pour les établissements scolaires africains
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Gérez votre <span className="text-emerald-600">caisse scolaire</span> en toute simplicité
            </h1>
            <p className="mt-6 text-lg text-gray-600 sm:text-xl">
              De l&apos;inscription de l&apos;élève au solde de sa scolarité.
              Encaissez, suivez les paiements, imprimez les reçus — le tout
              adapté au contexte ivoirien (FCFA, Mobile Money, affectation État).
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">
                  Démarrer maintenant
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
              <Link href="/parent">
                <Button size="lg" variant="outline" className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 sm:w-auto">
                  <Smartphone className="mr-2 size-4" />
                  Espace Parent
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400">
              Aucune installation. Accessible depuis votre navigateur.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 gap-8 border-t border-emerald-100 pt-12 sm:grid-cols-4">
            {[
              { value: "2", label: "Établissements" },
              { value: "8+", label: "Élèves gérés" },
              { value: "50+", label: "Endpoints API" },
              { value: "100%", label: "En français" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-emerald-600">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Tout ce dont votre établissement a besoin
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Une plateforme complète pour digitaliser l&apos;ensemble du cycle d&apos;encaissement scolaire.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: GraduationCap, title: "Gestion des élèves", desc: "Fiches complètes, matricules ministériels, catégories affecté/non-affecté, inscriptions par classe et année scolaire.", color: "emerald" },
              { icon: Wallet, title: "Caisse scolaire", desc: "Encaissement multi-mode (espèces, chèque, Mobile Money), reçus PDF numérotés, soldes en temps réel, clôture journalière.", color: "emerald" },
              { icon: Receipt, title: "Frais & échéanciers", desc: "Paramétrage par cycle/classe/catégorie. Scolarité échelonnée (5 ou 4 tranches), dérogations sociales, frais d&apos;examen.", color: "amber" },
              { icon: Smartphone, title: "Mobile Money", desc: "Intégration Orange Money, MTN Money, Wave. Les parents paient en ligne, les transactions sont tracées automatiquement.", color: "amber" },
              { icon: BarChart3, title: "Tableaux de bord", desc: "KPIs en temps réel : total encaissé, taux de recouvrement, impayés. Rapports filtrables, exports CSV/Excel.", color: "emerald" },
              { icon: ShieldCheck, title: "Multi-sites sécurisé", desc: "Gérez plusieurs établissements. Isolation des données par RLS PostgreSQL. Rôles RBAC avec chaîne hiérarchique.", color: "amber" },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-gray-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className={`flex size-12 items-center justify-center rounded-xl ${
                      feature.color === "emerald" ? "bg-emerald-100" : "bg-amber-100"
                    }`}>
                      <Icon className={`size-6 ${feature.color === "emerald" ? "text-emerald-600" : "text-amber-600"}`} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: feature.desc }} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Solutions ===== */}
      <section id="solutions" className="bg-gradient-to-br from-emerald-50 to-amber-50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge className="mb-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Pour les Directeurs
              </Badge>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Pilotez votre établissement en temps réel
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Suivez les encaissements, identifiez les impayés, générez des rapports
                en un clic. Plus besoin de fichiers Excel ou de saisie manuelle.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Vue globale des recettes et taux de recouvrement",
                  "Alertes sur les retards de paiement",
                  "Comptabilité générale en partie double automatique",
                  "Facturation SaaS multi-établissements",
                  "Mode support pour maintenance à distance",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <Button className="mt-8 bg-emerald-600 text-white hover:bg-emerald-700">
                  Découvrir l&apos;espace staff
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image src="/logo.png" alt="ScolaGest" width={28} height={28} className="rounded-md" />
                    <span className="font-semibold text-gray-900">Tableau de bord</span>
                  </div>
                  <Badge className="bg-emerald-600 text-white">Temps réel</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-2xl font-bold text-emerald-700">856 000</p>
                    <p className="text-xs text-emerald-600">FCFA encaissés</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-2xl font-bold text-amber-700">14.0%</p>
                    <p className="text-xs text-amber-600">Taux recouvrement</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-4">
                    <p className="text-2xl font-bold text-rose-700">5</p>
                    <p className="text-xs text-rose-600">Impayés</p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-4">
                    <p className="text-2xl font-bold text-sky-700">8</p>
                    <p className="text-xs text-sky-600">Élèves inscrits</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { name: "Kouassi Yann", amount: "40 000 FCFA", status: "PAYÉ" },
                    { name: "Traoré Awa", amount: "85 000 FCFA", status: "PAYÉ" },
                    { name: "Brou David", amount: "160 000 FCFA", status: "IMPAYÉ" },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-sm font-medium text-gray-700">{row.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{row.amount}</span>
                        <Badge variant="outline" className={
                          row.status === "PAYÉ" ? "border-emerald-300 text-emerald-700" : "border-rose-300 text-rose-700"
                        }>
                          {row.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Parent section ===== */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 lg:order-1">
              <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6 shadow-xl">
                <div className="mb-4 flex items-center gap-2">
                  <Smartphone className="size-6 text-amber-600" />
                  <span className="font-semibold text-gray-900">Espace Parent</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-xs text-gray-400">Numéro de téléphone</p>
                    <p className="font-mono text-lg">+225 07 01 02 03 04</p>
                  </div>
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-xs text-gray-400">Code PIN</p>
                    <p className="font-mono text-lg tracking-widest">• • • •</p>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Yann Kouassi — 6e 1</p>
                      <p className="text-xs text-gray-500">Solde dû</p>
                    </div>
                    <p className="text-xl font-bold text-emerald-700">100 000 F</p>
                  </div>
                  <Button className="w-full bg-amber-500 text-white hover:bg-amber-600">
                    <Smartphone className="mr-2 size-4" />
                    Payer avec Orange Money
                  </Button>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <Badge className="mb-4 bg-amber-100 text-amber-700 hover:bg-amber-100">
                Pour les Parents
              </Badge>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Les parents paient sans créer de compte
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Pas d&apos;email, pas de mot de passe. Le parent tape son numéro
                de téléphone et son code PIN pour consulter la scolarité de ses
                enfants et payer en Mobile Money.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Accès par téléphone + PIN (4 chiffres)",
                  "Visualisation des soldes de tous ses enfants",
                  "Paiement en ligne (Orange Money, MTN, Wave)",
                  "Récapitulatif imprimable pour payer à l&apos;école",
                  "Historique complet des paiements et reçus",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-600" />
                    <span className="text-gray-700" dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
              <Link href="/parent">
                <Button size="lg" className="mt-8 bg-amber-500 text-white hover:bg-amber-600">
                  Accéder à l&apos;espace parent
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Testimonials ===== */}
      <section id="testimonials" className="bg-gray-50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Conçu pour le terrain africain
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Pensé pour les réalités des établissements scolaires en Côte d&apos;Ivoire.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                name: "Collège Privé Le Chandelier",
                location: "Dabou, Côte d&apos;Ivoire",
                quote: "ScolaGest a digitalisé notre caisse. Les reçus sont générés automatiquement, les soldes sont en temps réel. Fini les fichiers Excel.",
                initials: "CL",
              },
              {
                name: "École Primaire Le Chandelier",
                location: "Dabou, Côte d&apos;Ivoire",
                quote: "Les parents paient en Orange Money directement depuis leur téléphone. Nous n&apos;avons plus besoin de gérer de l&apos;argent liquide.",
                initials: "EP",
              },
              {
                name: "Freelance Technologies CI",
                location: "Abidjan, Côte d&apos;Ivoire",
                quote: "L&apos;architecture multi-tenant avec RLS PostgreSQL garantit l&apos;isolation des données de chaque établissement. Une vraie plateforme SaaS.",
                initials: "FT",
              },
            ].map((t) => (
              <Card key={t.name} className="border-gray-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: `&ldquo;${t.quote}&rdquo;` }} />
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: t.name }} />
                      <p className="text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: t.location }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Des tarifs adaptés à l&apos;Afrique
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Choisissez le plan qui correspond à la taille de votre établissement.
              Prix en Francs CFA.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                name: "Basique",
                price: "25 000",
                period: "/mois",
                desc: "Pour les petites écoles (< 200 élèves)",
                features: ["Jusqu&apos;à 200 élèves", "5 utilisateurs", "Caisse & reçus", "Rapports de base"],
                highlighted: false,
              },
              {
                name: "Professionnel",
                price: "50 000",
                period: "/mois",
                desc: "Pour les établissements moyens (200-1000 élèves)",
                features: ["Jusqu&apos;à 1 000 élèves", "20 utilisateurs", "Mobile Money", "Comptabilité générale", "Tableaux de bord avancés"],
                highlighted: true,
              },
              {
                name: "Entreprise",
                price: "100 000",
                period: "/mois",
                desc: "Pour les groupes scolaires (+1000 élèves)",
                features: ["Élèves illimités", "Utilisateurs illimités", "Multi-sites", "Mode support", "Facturation SaaS", "Priorité support"],
                highlighted: false,
              },
            ].map((plan) => (
              <Card
                key={plan.name}
                className={plan.highlighted ? "border-emerald-400 shadow-lg ring-2 ring-emerald-400" : "border-gray-100 shadow-sm"}
              >
                <CardContent className="p-6">
                  {plan.highlighted && (
                    <Badge className="mb-4 bg-emerald-600 text-white">Populaire</Badge>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: plan.desc }} />
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-500">FCFA {plan.period}</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: f }} />
                      </li>
                    ))}
                  </ul>
                  <Link href="/login">
                    <Button
                      className={`mt-8 w-full ${plan.highlighted ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}`}
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      Commencer
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="bg-gray-50 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Questions fréquentes
            </h2>
          </div>

          <Accordion type="single" collapsible className="mt-12">
            {[
              { q: "Comment les parents accèdent-ils à l'espace parent ?", a: "Les parents n'ont pas besoin de créer un compte. Ils saisissent leur numéro de téléphone et un code PIN à 4 chiffres (communiqué par l'établissement). C'est tout !" },
              { q: "ScolaGest fonctionne-t-il avec Mobile Money ?", a: "Oui. ScolaGest intègre Orange Money, MTN Money et Wave. Les parents peuvent payer en ligne directement depuis l'espace parent." },
              { q: "Puis-je gérer plusieurs établissements ?", a: "Oui. ScolaGest est multi-tenant. Chaque établissement a ses propres données (élèves, paiements, frais). Le SUPER_ADMIN gère la plateforme, chaque Directeur gère son établissement." },
              { q: "Les données sont-elles sécurisées ?", a: "Absolument. ScolaGest utilise Row-Level Security (RLS) au niveau base de données PostgreSQL. Chaque établissement ne voit que ses propres données. L'isolation est garantie même en cas de bug applicatif." },
              { q: "Que se passe-t-il quand une classe est pleine ?", a: "Quand le quota d'élèves est atteint (configurable, défaut 45), ScolaGest crée automatiquement une nouvelle classe. Par exemple, 6e 1 devient pleine → 6e 2 est créée." },
              { q: "Comment sont gérés les élèves affectés par l'État ?", a: "ScolaGest distingue les élèves affectés (exonérés de scolarité) des non-affectés. Les frais d'inscription différent selon la catégorie. Le système gère aussi les dérogations sociales en 3 tranches." },
            ].map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium text-gray-900">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-gray-600 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-gradient-to-br from-emerald-600 to-emerald-700 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Prêt à digitaliser votre caisse scolaire ?
          </h2>
          <p className="mt-4 text-lg text-emerald-100">
            Rejoignez les établissements qui ont choisi la simplicité.
            Aucune installation, accessible immédiatement.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="w-full bg-white text-emerald-700 hover:bg-emerald-50 sm:w-auto">
                Démarrer maintenant
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
            <Link href="/parent">
              <Button size="lg" variant="outline" className="w-full border-amber-400 bg-amber-500 text-white hover:bg-amber-600 hover:border-amber-500 sm:w-auto">
                Espace Parent
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="ScolaGest" width={32} height={32} className="rounded-lg" />
                <span className="text-lg font-bold text-gray-900">ScolaGest</span>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Application web de gestion et de caisse scolaire pour les établissements africains.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900">Produit</h4>
              <ul className="mt-4 space-y-2">
                <li><a href="#features" className="text-sm text-gray-500 hover:text-emerald-600">Fonctionnalités</a></li>
                <li><a href="#pricing" className="text-sm text-gray-500 hover:text-emerald-600">Tarifs</a></li>
                <li><a href="/login" className="text-sm text-gray-500 hover:text-emerald-600">Espace Staff</a></li>
                <li><a href="/parent" className="text-sm text-gray-500 hover:text-emerald-600">Espace Parent</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900">Solutions</h4>
              <ul className="mt-4 space-y-2">
                <li><a href="#solutions" className="text-sm text-gray-500 hover:text-emerald-600">Caisse scolaire</a></li>
                <li><a href="#solutions" className="text-sm text-gray-500 hover:text-emerald-600">Mobile Money</a></li>
                <li><a href="#solutions" className="text-sm text-gray-500 hover:text-emerald-600">Comptabilité</a></li>
                <li><a href="#solutions" className="text-sm text-gray-500 hover:text-emerald-600">Multi-sites</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900">Contact</h4>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="size-4" /> Dabou, Côte d&apos;Ivoire
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone className="size-4" /> +225 07 01 02 03 04
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail className="size-4" /> contact@scolagest.ci
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-gray-100 pt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-center text-[10px] leading-relaxed text-gray-400 sm:text-xs">
              © 2026 ScolaGest. Développé par Freelance Technologies Côte d&apos;Ivoire. Tous droits réservés.
            </p>
            <div className="flex gap-4 sm:gap-6">
              <a href="#" className="text-xs text-gray-400 hover:text-emerald-600 sm:text-sm">Mentions légales</a>
              <a href="#" className="text-xs text-gray-400 hover:text-emerald-600 sm:text-sm">Confidentialité</a>
              <a href="#" className="text-xs text-gray-400 hover:text-emerald-600 sm:text-sm">CGU</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
