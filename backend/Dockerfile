# =============================================================================
# ScolaGest — Dockerfile backend Go 1.25 (Render / compatible Docker standard)
# =============================================================================
# Build multi-stage optimisé pour Render :
#   1. Stage « builder » : image officielle golang:1.25, compile le binaire
#      statique (CGO_ENABLED=0) → portable sur n'importe quelle base.
#   2. Stage « runtime » : image distroless minimale (gcr.io/distroless/static)
#      → pas de shell, pas de package manager, surface d'attaque réduite,
#      taille d'image ~10 Mo.
#
# Le binaire est compilé en statique pur (CGO_OFF) car le backend utilise
# glebarez/sqlite (driver SQLite pure-Go, sans cgo) — aucun binaire système
# requis à l'exécution.
#
# Variables d'environnement attendues (injectées par Render via dashboard) :
#   PORT              Port d'écoute (Render injecte automatiquement $PORT)
#   DATABASE_URL      URL PostgreSQL Neon (production)
#   JWT_SECRET        Secret JWT (OBLIGATOIRE en prod)
#   JWT_ACCESS_EXP_HR Durée access token (défaut 1h)
#   JWT_REFRESH_EXP_HR Durée refresh token (défaut 168h = 7j)
#   APP_ENV           development | production
#   CORS_ORIGINS      Origins CORS séparées par virgules
#
# Build local pour test :
#   docker build -t scolagest-backend backend/
#   docker run --rm -p 8080:8080 \
#     -e DATABASE_URL=postgresql://... \
#     -e JWT_SECRET=... \
#     -e APP_ENV=production \
#     scolagest-backend
# =============================================================================

# ---------- Stage 1 : builder ----------
FROM golang:1.25 AS builder

# Répertoire de travail = /app (le contexte de build est le dossier backend/)
WORKDIR /app

# 1. Copier d'abord les fichiers de dépendances pour exploiter le cache Docker.
#    Si go.mod / go.sum ne changent pas entre 2 builds, cette couche est
#    réutilisée → gain de temps significatif sur les déploiements Render.
COPY go.mod go.sum ./

# 2. Télécharger les dépendances (module cache officiel, pas de vendor).
RUN go mod download

# 3. Copier le reste du code source.
COPY . .

# 4. Build du binaire statique.
#    - CGO_ENABLED=0    : pas de cgo → binaire statique pur (portable).
#    - GOOS=linux       : target Linux (Render tourne sur Linux).
#    - GOARCH=amd64     : architecture x86_64 (instances Render starter/free).
#    - -ldflags="-s -w" : strip debug info + symbol table → binaire plus petit.
#    - -trimpath        : supprime les chemins absolus du poste de build.
#    Le résultat est un binaire unique `scolagest-backend` à la racine /app.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
      -trimpath \
      -ldflags="-s -w" \
      -o /app/scolagest-backend \
      ./cmd/server/

# ---------- Stage 2 : runtime (distroless minimal) ----------
# `nonroot` : l'utilisateur par défaut est `nonroot` (UID 65532), pas root.
# `static`  : image sans libc, idéale pour les binaires CGO_ENABLED=0.
FROM gcr.io/distroless/static-debian12:nonroot

# Metadata OCI standard (visible via `docker inspect`).
LABEL org.opencontainers.image.title="scolagest-backend" \
      org.opencontainers.image.description="Backend ScolaGest — Go (Gin + GORM)" \
      org.opencontainers.image.source="https://github.com/ftechnologies18/scolagest" \
      org.opencontainers.image.licenses="proprietary"

# Répertoire de travail dans l'image runtime.
WORKDIR /app

# Copier UNIQUEMENT le binaire depuis le stage builder.
# → L'image finale ne contient ni le code source, ni le cache Go, ni les
#   outils de compilation : surface d'attaque minimale.
COPY --from=builder /app/scolagest-backend /app/scolagest-backend

# Render injecte automatiquement $PORT (typiquement 10000 en prod).
# On l'expose pour la lisibilité (le conteneur écoute réellement sur $PORT).
EXPOSE 8080

# Variables d'environnement par défaut (peuvent être surchargées par Render).
ENV PORT=8080 \
    APP_ENV=production \
    GIN_MODE=release

# Binaire en tant qu'utilisateur nonroot (sécurité : pas de root).
USER nonroot:nonroot

# Point d'entrée : le binaire Go.
# Pas de shell dans distroless → on utilise la forme exec (JSON array).
ENTRYPOINT ["/app/scolagest-backend"]
