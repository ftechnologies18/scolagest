#!/bin/bash
# Démarre le backend Go ScolaGest (build si nécessaire puis exécution).
# Lancé via `bun run dev` par le mécanisme mini-services du projet.

set -e

export PATH="/home/z/.local/go/bin:$PATH"
BACKEND_DIR="/home/z/my-project/backend"
BIN="/tmp/scolagest-backend"

cd "$BACKEND_DIR"

# Rebuild si le binaire n'existe pas OU si des sources sont plus récentes
NEED_BUILD=0
if [ ! -f "$BIN" ]; then
  NEED_BUILD=1
else
  # Comparer le binaire aux sources .go
  if [ -n "$(find "$BACKEND_DIR" -name '*.go' -newer "$BIN" -print -quit 2>/dev/null)" ]; then
    NEED_BUILD=1
  fi
fi

if [ "$NEED_BUILD" -eq 1 ]; then
  echo "[backend] Compilation du backend Go..."
  go build -o "$BIN" ./cmd/server/
  echo "[backend] Compilation terminée."
fi

echo "[backend] Démarrage sur le port 8080..."
exec "$BIN"
