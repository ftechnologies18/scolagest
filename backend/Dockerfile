# =============================================================================
# ScolaGest — Dockerfile backend Go 1.25 (Render / compatible Docker standard)
# =============================================================================
# Build multi-stage pour Render :
#   1. Stage « builder » : image officielle golang:1.25, compile le binaire.
#   2. Stage « runtime » : debian-slim (shell disponible pour debug, plus
#      compatible Render que distroless).
#
# Le binaire est compilé en statique pur (CGO_ENABLED=0) mais linké avec libc
# pour compatibilité maximale avec debian-slim.
#
# ⚠ Render Docker : NE PAS définir ENV PORT dans le Dockerfile. Render injecte
# automatiquement $PORT (généralement 10000) au runtime. Le binaire le lit via
# os.Getenv("PORT"). Ne PAS non plus définir EXPOSE — Render route le trafic
# vers $PORT automatiquement.
#
# Variables d'environnement attendues (injectées par Render via dashboard) :
#   PORT              Port d'écoute (Render injecte automatiquement)
#   DATABASE_URL      URL PostgreSQL Neon (production)
#   JWT_SECRET        Secret JWT (OBLIGATOIRE en prod)
#   JWT_ACCESS_EXP_HR Durée access token (défaut 1h)
#   JWT_REFRESH_EXP_HR Durée refresh token (défaut 168h = 7j)
#   APP_ENV           development | production
#   CORS_ORIGINS      Origins CORS séparées par virgules
# =============================================================================

# ---------- Stage 1 : builder ----------
FROM golang:1.25 AS builder

WORKDIR /app

# 1. Copier go.mod/go.sum d'abord pour exploiter le cache Docker.
COPY go.mod go.sum ./
RUN go mod download

# 2. Copier le reste du code source.
COPY . .

# 3. Build du binaire.
#    - CGO_ENABLED=0 : binaire statique (portable).
#    - -ldflags="-s -w" : strip debug info → binaire plus petit.
#    - -trimpath : supprime les chemins absolus du poste de build.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
      -trimpath \
      -ldflags="-s -w" \
      -o /app/scolagest-backend \
      ./cmd/server/

# ---------- Stage 2 : runtime (debian-slim) ----------
# debian-slim : plus compatible Render que distroless, shell disponible pour
# debug, taille raisonnable (~80 Mo). On crée un utilisateur non-root.
FROM debian:12-slim

# Metadata OCI standard.
LABEL org.opencontainers.image.title="scolagest-backend" \
      org.opencontainers.image.description="Backend ScolaGest — Go (Gin + GORM)" \
      org.opencontainers.image.source="https://github.com/ftechnologies18/scolagest" \
      org.opencontainers.image.licenses="proprietary"

# Installer ca-certificates (requis pour les connexions TLS vers Neon HTTPS)
# et créer un utilisateur non-root.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r app && useradd -r -g app -u 10001 app

WORKDIR /app

# Copier le binaire depuis le stage builder.
COPY --from=builder /app/scolagest-backend /app/scolagest-backend

# Variables d'environnement (SANS PORT — Render l'injecte au runtime).
ENV APP_ENV=production \
    GIN_MODE=release

# Utilisateur non-root.
USER app

# Point d'entrée (forme exec).
ENTRYPOINT ["/app/scolagest-backend"]
