/**
 * Instrumentation hook Next.js — exécuté une fois au démarrage du serveur.
 *
 * Il démarre le backend Go ScolaGest (port 8080) en tant que processus enfant
 * du serveur Next.js, afin qu'il persiste tant que le dev server tourne.
 *
 * Le backend Go est ainsi disponible pour les appels API du frontend via
 * le gateway Caddy (?XTransformPort=8080).
 */

import { execFileSync, spawn } from "node:child_process";
import { createWriteStream, statSync, readdirSync } from "node:fs";
import type { Stats, Dirent } from "node:fs";

const BACKEND_BIN = "/tmp/scolagest-backend";
const BACKEND_DIR = "/home/z/my-project/backend";
const GO_BIN = "/home/z/.local/go/bin/go";
const BACKEND_LOG = "/home/z/my-project/backend/backend.log";
const BACKEND_PORT = 8080;

// Force le runtime Node.js (l'instrumentation peut sinon tourner dans l'Edge Runtime
// qui ne supporte pas node:child_process ni node:fs).
export const runtime = "nodejs";

let backendStarted = false;

async function isBackendUp(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isBackendUp()) return true;
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

function buildBackend(): boolean {
  try {
    console.log("[instrumentation] Compilation du backend Go...");
    execFileSync(GO_BIN, ["build", "-o", BACKEND_BIN, "./cmd/server/"], {
      cwd: BACKEND_DIR,
      stdio: "pipe",
      timeout: 120000,
    });
    console.log("[instrumentation] Backend compilé.");
    return true;
  } catch (e) {
    console.error("[instrumentation] Échec compilation backend:", e);
    return false;
  }
}

function spawnBackend() {
  const logStream = createWriteStream(BACKEND_LOG, { flags: "a" });
  logStream.write(`\n--- Démarrage backend ${new Date().toISOString()} ---\n`);

  const child = spawn(BACKEND_BIN, [], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      DB_PATH: "/home/z/my-project/backend/data/scolagest.db",
      JWT_SECRET: "scolagest-dev-secret-change-in-production-2026",
      APP_ENV: "development",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);

  child.on("exit", (code: number | null) => {
    console.log(`[instrumentation] Backend Go terminé (code=${code})`);
    if (!backendStarted) return;
    if (code !== 0) {
      console.log("[instrumentation] Redémarrage backend dans 3s...");
      setTimeout(() => {
        if (backendStarted) spawnBackend();
      }, 3000);
    }
  });

  child.on("error", (err: Error) => {
    console.error("[instrumentation] Erreur backend Go:", err);
  });

  console.log(`[instrumentation] Backend Go démarré (PID=${child.pid})`);
}

function sourcesNewerThan(dir: string, ref: Date): boolean {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory() && !e.name.startsWith(".")) {
      if (sourcesNewerThan(full, ref)) return true;
    } else if (e.isFile() && e.name.endsWith(".go")) {
      let st: Stats;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.mtime > ref) return true;
    }
  }
  return false;
}

export async function register() {
  if (typeof window !== "undefined") return;

  backendStarted = true;

  if (await isBackendUp()) {
    console.log("[instrumentation] Backend déjà en ligne.");
    return;
  }

  let needBuild = true;
  try {
    const binStat = statSync(BACKEND_BIN);
    needBuild = sourcesNewerThan(BACKEND_DIR, binStat.mtime);
  } catch {
    needBuild = true;
  }

  if (needBuild) {
    if (!buildBackend()) return;
  }

  spawnBackend();

  const ready = await waitForBackend(20000);
  if (ready) {
    console.log("[instrumentation] Backend prêt sur le port 8080.");
  } else {
    console.warn(
      "[instrumentation] Backend non prêt après 20s — voir backend.log"
    );
  }
}
