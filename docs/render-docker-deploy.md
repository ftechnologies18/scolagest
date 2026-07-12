# Déploiement backend Render via Dockerfile (Go 1.25)

Ce guide explique comment basculer le service Render `scolagest-backend` de
l'environnement **Go natif** (qui échoue car Render ne supporte pas encore
Go 1.25 par défaut) vers un build **Docker** basé sur le `Dockerfile` du
dépôt (qui utilise l'image officielle `golang:1.25`).

> **Contexte** : les 10 derniers déploiements Render sont en `update_failed`
> car `backend/go.mod` exige `go 1.25.0` mais l'environnement Go par défaut
> de Render est antérieur. Le `Dockerfile` contourne ce problème en apportant
> son propre toolchain Go 1.25.

---

## 1. Vérifier que le Dockerfile est bien sur `main`

Le commit contenant `backend/Dockerfile` + `backend/.dockerignore` doit être
poussé sur `main` (Render lit le dépôt GitHub).

```bash
git log --oneline -3
# doit montrer le commit avec "feat(docker): Dockerfile backend Go 1.25"
```

## 2. Sur le dashboard Render

1. Aller sur https://dashboard.render.com/web/srv-d98mdrv7f7vs73bdlm60
2. Cliquer sur **Settings** (en haut à gauche).
3. Dans la section **Build & Deploy**, modifier :

   | Champ | Valeur actuelle (Go natif) | Nouvelle valeur (Docker) |
   |---|---|---|
   | **Runtime** | `Go` | `Docker` |
   | **Build Command** | `go build -o scolagest-backend ./cmd/server/` | _(laisser vide — Docker gère)_ |
   | **Start Command** | `./scolagest-backend` | _(laisser vide — Docker gère)_ |
   | **Dockerfile Path** | _(vide)_ | `./backend/Dockerfile` |
   | **Docker Build Context Directory** | _(vide)_ | `backend` |
   | **Root Directory** | `backend` | `backend` (inchangé) |
   | **Auto-Deploy** | `no` | `yes` (recommandé) |

   > ⚠️ **Important** : le **Docker Build Context Directory** doit être
   > `backend` (pas `/backend`, pas `./backend/`), car le `Dockerfile`
   > référence des chemins relatifs à ce dossier (`COPY go.mod go.sum ./`).

4. Cliquer sur **Save Changes**.

## 3. Variables d'environnement (section **Environment**)

Vérifier que ces variables sont bien définies (elles sont injectées au
runtime dans le conteneur) :

| Variable | Valeur attendue | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:***@ep-hidden-pond-abyt31ac-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require` | Neon PostgreSQL |
| `JWT_SECRET` | _(chaîne aléatoire longue ≥ 32 caractères)_ | **OBLIGATOIRE** — ne pas utiliser la valeur de dev |
| `JWT_ACCESS_EXP_HR` | `1` | Access token : 1 heure |
| `JWT_REFRESH_EXP_HR` | `168` | Refresh token : 7 jours |
| `APP_ENV` | `production` | |
| `CORS_ORIGINS` | `https://scolagest.vercel.app` | Origine du frontend Vercel |

> Render injecte automatiquement la variable `PORT` (typiquement `10000`).
> Le backend lit `PORT` via `config.Load()` et écoute dessus. **Ne pas la
> définir manuellement**.

## 4. Déclencher un déploiement

Sur le dashboard Render :
1. Cliquer sur **Manual Deploy** → **Deploy latest commit**.
2. Attendre 3-5 minutes (build Docker + push image + démarrage conteneur).
3. Surveiller les logs en temps réel (onglet **Logs** ou **Events**).

### Signes de succès attendus dans les logs :

```
==> Cloning from https://github.com/ftechnologies18/scolagest
==> Running build command 'docker build -f ./backend/Dockerfile...'...
==> Downloading base image golang:1.25...
==> go build -trimpath -ldflags="-s -w" ...
==> Image pushed successfully
==> Starting service...
🚀 ScolaGest backend — env=production port=10000
🔌 Connexion à PostgreSQL (Neon)...
✓ Connecté à PostgreSQL
==> Your service is live 🎉
```

## 5. Vérification post-déploiement

Une fois le statut **Live**, tester les endpoints :

```bash
# Health check
curl https://scolagest-backend.onrender.com/api/health
# → {"env":"production","service":"scolagest-backend","status":"ok","version":"1.0.0"}

# RBAC backend (caissier ne doit plus accéder à /comptabilite)
TOKEN=$(curl -s -X POST https://scolagest-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"caissier@scolagest.ci","password":"caissier123","etablissement_id":"9f873e88-0ed6-48e0-a1bd-3fc9ab3cb7bc"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "caissier /api/comptabilite → HTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  https://scolagest-backend.onrender.com/api/comptabilite/exercices
# → HTTP 403  (défense en profondeur backend active)
```

## 6. En cas d'échec

Si le déploiement Docker échoue aussi :

1. **Lire les logs Render** (onglet Logs) — l'erreur exacte s'y trouve.
2. Causes possibles :
   - `Docker Build Context Directory` mal configuré → vérifier que c'est
     `backend` (le `Dockerfile` fait `COPY go.mod go.sum ./` depuis ce dossier).
   - `Dockerfile Path` doit être `./backend/Dockerfile` (chemin depuis la
     racine du dépôt).
   - Variables d'environnement manquantes → le backend `log.Fatalf` si la
     connexion DB échoue.
3. Pour tester le Dockerfile en local :
   ```bash
   cd /home/z/scolagest
   docker build -t scolagest-backend -f backend/Dockerfile backend/
   docker run --rm -p 8080:8080 \
     -e DATABASE_URL="postgresql://..." \
     -e JWT_SECRET="test-secret-32-chars-minimum-aaa" \
     -e APP_ENV=production \
     scolagest-backend
   ```

---

## Pourquoi ce Dockerfile est meilleur que l'environnement Go natif Render

| Critère | Render Go natif | Dockerfile (ce dépôt) |
|---|---|---|
| Version Go | Limitée à ce que Render supporte | **Go 1.25.0** officiel (toujours à jour) |
| Taille image finale | ~1 Go (image Go complète) | **~30 Mo** (distroless static) |
| Surface d'attaque | Shell + package manager | **Aucun shell** (distroless) |
| Utilisateur | Variable | **`nonroot`** (UID 65532) |
| Reproductibilité | Dépend de l'environnement Render | **Totale** (image pinned) |
| Cache de build | Non optimisé | **Multi-stage** (cache go mod) |
| Binaire | Dynamique (libc) | **Statique pur** (CGO_ENABLED=0) |
