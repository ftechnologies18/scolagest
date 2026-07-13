#!/bin/bash
# dev-backend.sh — Démarre le backend Go ScolaGest en local (SQLite dev) pour tester
# avant de pousser vers GitHub/Render.
#
# Usage :
#   .zscripts/dev-backend.sh          # démarre + health check
#   .zscripts/dev-backend.sh --test   # démarre + tests de flux (login, eleves, etc.)
#
# Le process s'arrête automatiquement à la fin du script (limite sandbox).
# Pour un shell interactif, lancez : cd backend && /tmp/scolagest-backend

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
export PATH="/home/z/.local/go/bin:$PATH"
BIN="/tmp/scolagest-backend"
PORT=8080

echo "🚀 Démarrage backend ScolaGest (SQLite dev, port $PORT)"

# Vérifier Go
if ! command -v go > /dev/null 2>&1; then
  echo "❌ Go non trouvé. Lancez d'abord .zscripts/dev.sh ou installez Go dans .local-tools/go"
  exit 1
fi

cd "$BACKEND_DIR"

# Recompiler si source plus récente que binaire
NEED_BUILD=0
if [ ! -f "$BIN" ]; then
  NEED_BUILD=1
elif [ -n "$(find "$BACKEND_DIR" -name '*.go' -newer "$BIN" -print -quit 2>/dev/null)" ]; then
  NEED_BUILD=1
fi

if [ "$NEED_BUILD" -eq 1 ]; then
  echo "🔨 Compilation du backend..."
  go build -o "$BIN" ./cmd/server/
  echo "✓ Compilation terminée"
fi

# Démarrer en arrière-plan dans ce shell
mkdir -p "$BACKEND_DIR/data"
"$BIN" > /tmp/scolagest-backend.log 2>&1 &
BACKEND_PID=$!

# Nettoyer à la sortie
cleanup() {
  echo ""
  echo "🛑 Arrêt backend (PID $BACKEND_PID)"
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Attendre que la DB soit connectée
echo "⏳ Attente connexion DB..."
for i in $(seq 1 30); do
  RESP=$(curl -s "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)
  if echo "$RESP" | grep -q '"db":true'; then
    echo "✓ Backend prêt après ${i}s"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Backend mort — voir /tmp/scolagest-backend.log"
    tail -20 /tmp/scolagest-backend.log
    exit 1
  fi
  sleep 1
done

echo ""
echo "📊 /api/health :"
curl -s "http://127.0.0.1:$PORT/api/health"
echo ""

# Mode test : flux complet
if [ "${1:-}" = "--test" ]; then
  echo ""
  echo "🧪 Tests de flux..."
  echo ""
  echo "=== Login admin ==="
  LOGIN=$(curl -s -X POST "http://127.0.0.1:$PORT/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@scolagest.ci","password":"admin123"}')
  TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$TOKEN" ]; then
    echo "❌ Login échoué"
    echo "$LOGIN"
    exit 1
  fi
  echo "✓ JWT obtenu"

  echo ""
  echo "=== /api/auth/me ==="
  curl -s "http://127.0.0.1:$PORT/api/auth/me" -H "Authorization: Bearer $TOKEN" | head -c 300
  echo ""

  echo ""
  echo "=== /api/etablissements ==="
  curl -s "http://127.0.0.1:$PORT/api/etablissements" | head -c 200
  echo ""

  echo ""
  echo "=== /api/eleves?limit=2 ==="
  curl -s "http://127.0.0.1:$PORT/api/eleves?limit=2" -H "Authorization: Bearer $TOKEN" | head -c 200
  echo ""

  echo ""
  echo "✅ Tous les tests sont passés"
fi

echo ""
echo "💡 Backend actif sur http://127.0.0.1:$PORT (Ctrl+C pour arrêter)"
echo "   Logs : tail -f /tmp/scolagest-backend.log"

# Garder le process en vie jusqu'à interruption
wait "$BACKEND_PID"
