# Aislar el worker del código de UI — mínimo viable

## Por qué

El worker importa 8 módulos de `src/lib`. Uno de ellos, `src/lib/recibosDetect.ts`, tiene en su
**línea 1**:

```ts
import { toast } from 'sonner'
```

`sonner` es una librería de toasts de React. Hoy el worker la carga en runtime — no rompe porque
`tsx` la resuelve y el código que la usa nunca se ejecuta del lado del worker, pero es un cruce
real de frontera: el proceso de background depende del árbol de dependencias del front. Verificado
con `tsc --listFiles`: `node_modules/sonner/dist/index.d.mts` está dentro del grafo del worker.

Hay además un segundo cruce, más sutil: `src/lib/aditus.ts` usa `fetch(url, { cache: 'no-store' })`
en 5 lugares. `cache` es una **extensión de Next.js** al `RequestInit` estándar; en Node puro no
existe. Hoy es inerte (Node lo ignora), pero es la misma clase de problema.

Este plan hace lo mínimo para arreglar el cruce real, volverlo verificable y enforzarlo en CI. No
reestructura el repo ni mueve `src/lib` a un paquete compartido — eso queda para después, si se
justifica.

**Este plan va ANTES de `docs/worker-plan.md`** (el deploy). No tiene sentido desplegar el worker
sin haber cerrado la frontera primero.

## Estado verificado (2026-09-07)

Todo lo de abajo está chequeado contra el repo, no asumido:

- **Consumidores de lo que se mueve:** solo 2 archivos de app.
  - `detectarLegajoPdf` → `src/components/lotes/AgregarRecibosDialog.tsx`, `src/components/lotes/LoteDetalle.tsx`
  - `runWithConcurrency` → los mismos 2
  - `RecibosEntry` → solo `AgregarRecibosDialog.tsx`
  - `DetectedData` → solo uso interno de `recibosDetect.ts`
- **Consumidores de lo que se queda:** `extraerMetadataDesdeFilename` (por
  `src/lib/validators/nomenclador.ts` y `worker/handlers/ingestSftp.ts`) y
  `detectarLegajoDesdeFilename` (por `src/lib/validators/legajo.ts` y los 2 componentes).
- **Typecheck del worker con `lib: ["ES2022"]`:** 10 errores, todos explicados (ver más abajo).
  Antes de `npx prisma generate` daban 71 — el cliente generado estaba desactualizado respecto del
  schema (le faltaban `jobQueue`, `sftpArchivoProcesado` y los campos SFTP de `GeneralConfig`).

## Paso 1 — Partir `src/lib/recibosDetect.ts`

`recibosDetect.ts` mezcla dos cosas: parsing puro de nombres de archivo (que el worker necesita) y
detección asistida por UI (que hace `fetch` a una API route y muestra toasts).

**Queda en `src/lib/recibosDetect.ts`** (puro, sin dependencias de browser):
- `plantillaARegex()` (L33)
- `FilenameMetadata` (L84)
- `extraerMetadataDesdeFilename()` (L96)
- `matchLegajo()` (L127, privada)
- `detectarLegajoDesdeFilename()` (L136)

Se borra el `import { toast } from 'sonner'` de la línea 1.

**Se mueve a `src/lib/recibosDetect.client.ts`** (nuevo):
- `import { toast } from 'sonner'`
- `DetectedData` (L3)
- `RecibosEntry` (L10) — tiene `file: File`, tipo del DOM
- `detectarLegajoPdf()` (L163) — `fetch('/api/lotes/detectar-legajo')` + `toast.error()`
- `runWithConcurrency()` (L199) — puro, pero solo lo usa la UI; va acá para no dejar un módulo
  con un único export huérfano

El módulo nuevo reexporta de `./recibosDetect` lo que necesite (`detectarLegajoDesdeFilename`,
`FilenameMetadata`) para que los componentes puedan seguir importando de un solo lugar si conviene.

**Imports a actualizar: 2 archivos.**
- `src/components/lotes/AgregarRecibosDialog.tsx`
- `src/components/lotes/LoteDetalle.tsx`

Nada más toca los símbolos que se mueven. El sufijo `.client.ts` es convención, no magia de
Next — no cambia el bundling, solo hace la intención legible.

## Paso 2 — `tsconfig.worker.json`

Archivo nuevo en la raíz:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "noEmit": true,
    "incremental": false
  },
  "include": ["worker/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

Quitar `lib.dom` hace que TypeScript tipee el worker como lo que es: un proceso Node, sin `window`,
sin `document`, sin el `fetch` extendido de Next.

**Qué atrapa y qué no — importante, porque acá me equivoqué al principio.** Este tsconfig **no**
detecta el import de `sonner`: `sonner` trae sus propios tipos y no depende de `lib.dom`, así que
compila limpio. Lo que sí atrapa son los usos de APIs de browser y las extensiones de Next al
estándar. El chequeo de frontera de verdad es el del paso 3.

### Los 10 errores actuales y qué hacer con cada uno

| Archivo | Error | Acción |
|---|---|---|
| `src/lib/aditus.ts` (45, 171, 186, 247, 312) | `'cache' does not exist in type 'RequestInit'` | Ver abajo — **decisión pendiente** |
| `src/lib/recibosDetect.ts` (182-185) | `'data' is of type 'unknown'` | **Se resuelve solo** con el paso 1: ese código está dentro de `detectarLegajoPdf`, que se va a `.client.ts` y sale del grafo del worker |
| `worker/sftpClient.ts:1` | `Cannot find module 'ssh2-sftp-client'` | **Ruido local.** Está declarado en `package.json` (`^12.1.1`) con `@types/ssh2-sftp-client` (`^9.0.6`), pero no instalado en el `node_modules` de esta máquina. Correr `npm install`. En CI, con `npm ci`, no aparece |

**El `cache: 'no-store'` de `aditus.ts` — dos opciones, hay que elegir:**

- **(a) Sacarlo.** Es un no-op en Node y en el App Router de Next las route handlers ya son
  dinámicas por defecto en la mayoría de los casos. Riesgo: si alguna de esas 5 llamadas se ejecuta
  desde un Server Component cacheado, sacarlo cambia el comportamiento del front. **Hay que
  verificar los call sites antes de tocar nada.**
- **(b) Documentar la excepción.** Dejar el código como está y agregar en el tsconfig del worker
  `"skipLibCheck": true` no alcanza (el error es del código propio, no de libs). Habría que castear:
  `fetch(url, { cache: 'no-store' } as RequestInit)`. Feo, pero honesto: dice "acá hay una
  dependencia de Next que conocemos".

Recomiendo **(a)** si la verificación de call sites da que ninguno corre en contexto cacheado, y
**(b)** en caso contrario. Esto no bloquea los otros pasos: se puede dejar el typecheck del worker
fuera de CI (paso 3) hasta resolverlo.

## Paso 3 — Chequeo de frontera + stage `test` en CI

### 3a. Script de frontera

Lo que realmente detecta el cruce es listar el grafo del worker y buscar módulos prohibidos.
Nuevo `scripts/check-worker-boundary.mjs`, sin dependencias nuevas:

```js
// Falla si el grafo de compilación del worker alcanza código de UI.
// El typecheck solo no lo detecta: sonner y react traen sus propios tipos.
import { execSync } from 'node:child_process'

const PROHIBIDOS = [
  /node_modules[\\/](sonner|react|react-dom|next|@radix-ui)[\\/]/,
  /[\\/]src[\\/](components|app)[\\/]/,
]

const files = execSync('npx tsc -p tsconfig.worker.json --noEmit --listFiles', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).split('\n')

const violaciones = files.filter(f => PROHIBIDOS.some(re => re.test(f)))
if (violaciones.length) {
  console.error('El worker alcanza codigo de UI:')
  violaciones.forEach(f => console.error('  ' + f))
  process.exit(1)
}
console.log(`worker boundary ok (${files.length} archivos)`)
```

**Ojo con el orden:** `tsc --listFiles` sale con código ≠ 0 si hay errores de tipo, y `execSync`
tira excepción. Por eso este script debe correr **después** de que el typecheck del worker pase
limpio — o sea, después de resolver el `cache` de `aditus.ts`. Si se quiere adelantar, hay que
envolver el `execSync` en try/catch y usar el stdout igual.

Baseline esperado hoy: **1 violación** (`sonner`). Después del paso 1: **0**.

Scripts a agregar en `package.json`:

```json
"typecheck:worker": "tsc -p tsconfig.worker.json --noEmit",
"check:worker-boundary": "node scripts/check-worker-boundary.mjs"
```

### 3b. Stage `test` en `.gitlab-ci.yml`

Hoy el pipeline es `build → migrate → deploy`. **No hay ningún job de test, lint ni typecheck** —
nada valida el código antes de construir la imagen. Agregar un stage `test` primero:

```yaml
stages:
  - test
  - build
  - migrate
  - deploy

typecheck_worker:
  stage: test
  tags:
    - aditus-demo
  script:
    - npm ci
    - npx prisma generate
    - npm test
    - npm run typecheck:worker
    - npm run check:worker-boundary
  rules:
    - if: '$CI_COMMIT_BRANCH == "master" || $CI_COMMIT_BRANCH == "develop"'
```

**`npx prisma generate` no es opcional en este job.** Sin él, el typecheck del worker falla con
~60 errores falsos por el cliente desactualizado — exactamente lo que pasó al validar este plan.

`npm test` **sí se incluye** — verificado el 2026-09-07: `vitest run` da 2 archivos, **32 tests, todos
en verde, en 4 segundos**. No cubre el worker (los tests son de otra parte del código), pero un job
que ya pasa no cuesta nada y evita que la suite se pudra en silencio.

## Orden de ejecución

1. `npm install` (traer `ssh2-sftp-client` y sacar el falso positivo local).
2. Paso 1: partir `recibosDetect.ts`, actualizar los 2 componentes.
3. Paso 2: crear `tsconfig.worker.json`, correr `npm run typecheck:worker`.
   Debería quedar solo el bloque de `cache` en `aditus.ts` (5 errores).
4. Decidir (a) o (b) para `aditus.ts` — verificando antes desde dónde se llaman esas funciones.
5. Paso 3a: script de frontera. Correrlo local: debe dar `0 violaciones`.
6. Paso 3b: stage `test` en el CI. Pushear a `develop` y confirmar que el job pasa **verde antes**
   de que corra el `build`.
7. Recién entonces, ejecutar `docs/worker-plan.md` (el deploy).

## Verificación

- `npm run typecheck:worker` → 0 errores.
- `npm run check:worker-boundary` → `worker boundary ok`.
- `npm run build` → la app sigue compilando (el paso 1 tocó 2 componentes).
- `npm run worker` local → arranca igual que antes.
- Prueba negativa (la que confirma que el chequeo sirve): agregar temporalmente
  `import { toast } from 'sonner'` en `worker/index.ts` y verificar que
  `check:worker-boundary` **falla**. Después revertir. Sin esta prueba no sabés si el guard
  funciona o si simplemente nunca dispara.

## Qué queda afuera a propósito

- Mover `src/lib` compartido a un paquete o workspace separado — el diff sería enorme y el
  beneficio marginal sobre lo de arriba.
- Reemplazar el alias `@/*` en el worker por rutas relativas.
- `dependency-cruiser` o similar. El script de 15 líneas cubre este caso; si mañana hacen falta
  reglas de frontera más ricas, ahí sí conviene la herramienta.
- Tests unitarios del worker (no existen hoy).
