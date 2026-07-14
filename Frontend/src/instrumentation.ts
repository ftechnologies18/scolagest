/**
 * Instrumentation hook Next.js — exécuté une fois au démarrage du serveur.
 *
 * Il démarre le backend Go ScolaGest (port 8080) en tant que processus enfant
 * du serveur Next.js, afin qu'il persiste tant que le dev server tourne.
 *
 * IMPORTANT : Les imports de modules Node (node:child_process, node:fs) sont faits
 * dynamiquement à l'intérieur de register() pour éviter les erreurs "Edge Runtime"
 * lors de l'évaluation du module par Next.js.
 *
 * Comportement :
 *  - Si NEXT_PUBLIC_API_BASE_URL est défini (backend distant, ex. Render), le
 *    démarrage local est entièrement ignoré — inutile et source d'erreurs au boot.
 *  - Sinon (mode sandbox/dev local), le backend Go est compilé puis lancé sur
 *    le port BACKEND_PORT. Les paths sont configurables via env vars.
 */

// Paths configurables via env vars (sûrs pour Edge Runtime — process.env only).
// Defaults absolus pour le sandbox /home/z/my-project. Pour un autre emplacement
// (ex. clone /home/z/scolagest), définir BACKEND_DIR et BACKEND_LOG dans Frontend/.env.
const BACKEND_BIN = process.env.BACKEND_BIN || "/tmp/scolagest-backend";
const GO_BIN = process.env.GO_BIN || "/home/z/.local/go/bin/go";
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "8080", 10);
const BACKEND_DIR = process.env.BACKEND_DIR || "/home/z/my-project/backend";
const BACKEND_LOG = process.env.BACKEND_LOG || (BACKEND_DIR + "/backend.log");

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

async function waitForBackend(timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isBackendUp()) return true;
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

 
async function buildBackend(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require("node:child_process") as {
      execFileSync: (
        cmd: string,
        args: string[],
        opts: { cwd: string; stdio: "pipe"; timeout: number }
      ) => void;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as {
      existsSync: (p: string) => boolean;
    };
    // Vérifier que le toolchain Go et le dossier backend existent.
    if (!fs.existsSync(GO_BIN)) {
      console.warn(`[instrumentation] Go introuvable (${GO_BIN}) — installez Go ou définissez GO_BIN. Skip du backend local.`);
      return false;
    }
    if (!fs.existsSync(BACKEND_DIR)) {
      console.warn(`[instrumentation] Dossier backend introuvable (${BACKEND_DIR}) — définissez BACKEND_DIR. Skip du backend local.`);
      return false;
    }
    console.log(`[instrumentation] Compilation du backend Go (cwd=${BACKEND_DIR})...`);
    execFileSync(
      GO_BIN,
      ["build", "-o", BACKEND_BIN, "./cmd/server/"],
      { cwd: BACKEND_DIR, stdio: "pipe", timeout: 120000 }
    );
    console.log("[instrumentation] Backend compilé.");
    return true;
     
  } catch (e: any) {
    console.error("[instrumentation] Échec compilation backend:", e?.message || e);
    return false;
  }
}

 
function spawnBackend(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawn } = require("node:child_process") as {
    spawn: (cmd: string, args: string[], opts: object) => {
      pid: number;
      stdout: { pipe: (w: unknown) => void };
      stderr: { pipe: (w: unknown) => void };
      on: (ev: string, cb: (arg?: number | Error) => void) => void;
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as {
    createWriteStream: (path: string, opts: { flags: string }) => {
      write: (s: string) => void;
    };
    statSync: (path: string) => { mtime: Date };
    readdirSync: (dir: string, opts: { withFileTypes: boolean }) => Array<{
      name: string;
      isDirectory: () => boolean;
      isFile: () => boolean;
    }>;
  };

  let logStream: { write: (s: string) => void };
  try {
    logStream = fs.createWriteStream(BACKEND_LOG, { flags: "a" });
    logStream.write(`\n--- Démarrage backend ${new Date().toISOString()} ---\n`);
  } catch {
    // Fallback si le dossier n'existe pas
    logStream = { write: () => {} };
  }

  const child = spawn(BACKEND_BIN, [], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      // DB_PATH : SQLite dev local (relatif à BACKEND_DIR). Ignoré si DATABASE_URL est défini.
      DB_PATH: process.env.DB_PATH || (BACKEND_DIR + "/data/scolagest.db"),
      // DATABASE_URL / JWT_SECRET : hérités de process.env (ne JAMAIS hardcoder
      // de secrets en source — utiliser Frontend/.env ou les env vars Render).
      JWT_SECRET: process.env.JWT_SECRET || "scolagest-dev-secret-change-in-production",
      APP_ENV: process.env.APP_ENV || "development",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  try {
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
  } catch {
    /* noop */
  }

  child.on("exit", (code) => {
    console.log(`[instrumentation] Backend Go terminé (code=${code})`);
    if (!backendStarted) return;
    if (code !== 0) {
      console.log("[instrumentation] Redémarrage backend dans 3s...");
      setTimeout(() => {
        if (backendStarted) spawnBackend();
      }, 3000);
    }
  });

  child.on("error", (err) => {
    console.error("[instrumentation] Erreur backend Go:", err);
  });

  console.log(`[instrumentation] Backend Go démarré (PID=${child.pid})`);
  return true;
}

export async function register() {
  // Uniquement côté serveur
  if (typeof window !== "undefined") return;

  // Mode backend distant : si NEXT_PUBLIC_API_BASE_URL est défini (ex. Render en
  // prod), on ne démarre PAS de backend local. Cela évite les erreurs ENOENT au
  // boot quand le toolchain Go ou le dossier backend n'est pas présent.
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    console.log(
      `[instrumentation] Backend distant configuré (${process.env.NEXT_PUBLIC_API_BASE_URL}) — skip du démarrage local.`
    );
    return;
  }

  backendStarted = true;

  if (await isBackendUp()) {
    console.log("[instrumentation] Backend déjà en ligne.");
    return;
  }

  // Vérifier que le binaire existe, sinon le compiler
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as {
    statSync: (path: string) => { mtime: Date };
    readdirSync: (dir: string, opts: { withFileTypes: boolean }) => Array<{
      name: string;
      isDirectory: () => boolean;
      isFile: () => boolean;
    }>;
  };

  let needBuild = true;
  try {
    const binStat = fs.statSync(BACKEND_BIN);
    needBuild = sourcesNewerThan(BACKEND_DIR, binStat.mtime, fs.readdirSync);
  } catch {
    needBuild = true;
  }

  if (needBuild) {
    const ok = await buildBackend();
    if (!ok) return;
  }

  spawnBackend();

  const ready = await waitForBackend(25000);
  if (ready) {
    console.log("[instrumentation] Backend prêt sur le port 8080.");
  } else {
    console.warn(
      "[instrumentation] Backend non prêt après 25s — voir backend.log"
    );
  }
}

// Helper pour vérifier si les sources .go sont plus récentes que le binaire
function sourcesNewerThan(
  dir: string,
  ref: Date,
   
  readdirSync: (dir: string, opts: { withFileTypes: boolean }) => any[]
): boolean {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory() && !e.name.startsWith(".")) {
      if (sourcesNewerThan(full, ref, readdirSync)) return true;
    } else if (e.isFile() && e.name.endsWith(".go")) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require("node:fs") as { statSync: (p: string) => { mtime: Date } };
        const st = fs.statSync(full);
        if (st.mtime > ref) return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}
