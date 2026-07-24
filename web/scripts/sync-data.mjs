// Copia ../data -> public/data para que el sitio estático sirva los JSON del repo.
// Corre automáticamente antes de `npm run dev` y `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "data");
const dest = join(here, "..", "public", "data");

if (!existsSync(src)) {
  console.error(`No existe ${src}: corré el pipeline primero.`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`data sincronizada -> ${dest}`);
