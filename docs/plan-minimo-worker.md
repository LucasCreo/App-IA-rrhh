# Plan mínimo — poner el worker a correr en producción

Objetivo: que `aditus-rrhh-worker` corra como **contenedor separado** de la app web en el
servidor on-prem, desplegado por el mismo pipeline. Nada más.

## Aclaración previa: el worker no usa puertos

La pregunta que originó este plan fue "que el worker corra en un puerto y la app en otro". El
worker **no escucha en ningún puerto**: no es un servidor HTTP, es un proceso que hace polling de
la tabla `JobQueue` y del SFTP. No hay nada que exponer ni que mapear.

Lo que sí se busca —y es lo que este plan entrega— es que sean **dos contenedores independientes**:
la app en `6106:3000` y el worker sin `ports`. Precedente en el mismo compose:
`aditus-bpm-worker` (`docker-compose-aditus.yml:75-83`) tampoco publica puertos.

Si en algún momento hace falta un puerto en el worker, sería únicamente para un endpoint
`/health` de monitoreo. Hoy ese endpoint no existe y queda fuera de alcance.

## Estado verificado (2026-09-07)

- `docker_build` ya construye y pushea la imagen worker con tag `$CI_COMMIT_REF_NAME-worker`.
  No es teórico: `migrate_template` (`.gitlab-ci.yml:61-65`) ya la hace `docker pull` y corre
  scripts adentro. **La imagen funciona.**
- Nadie la levanta como servicio: no hay `aditus-rrhh-worker` en
  `infra/docker-compose-aditus.yml` ni referencia en `deploy_master`.
- `worker/index.ts` **no carga el env**. No hay `import 'dotenv/config'` en ningún lado del árbol
  del worker y `tsx` no lo hace solo. Arrancaría sin `DATABASE_URL`.
- `dotenv` **no está** en `dependencies` de `package.json` — solo aparece como dependencia
  transitiva en `package-lock.json:584`. Depender de eso es frágil.
- `Dockerfile.worker:37` copia el env como `./.env.production`, pero `dotenv/config` busca `./.env`.
- `.env.production` tiene 17 placeholders `__X__` que el CI materializa con `sed` en el
  `before_script`, antes del `docker build`. Ese mecanismo ya funciona para la imagen web.

## Cambios — repo `gestion-rrhh`

### 1. `package.json` — declarar `dotenv`

```
npm install dotenv
```

Que quede en `dependencies` para que el `npm ci` del Dockerfile lo garantice, en vez de heredarlo
por casualidad de Prisma.

### 2. `worker/index.ts` — cargar el env

Primer import del archivo, **antes** de `./jobRunner` y `./sftpWatcher`:

```ts
import 'dotenv/config'
import { hostname } from 'os'
import { runJobLoop } from './jobRunner'
```

El orden importa: esos módulos arrastran `@/lib/prisma` y `@/lib/aditus`, que leen `process.env`
en import time. Si `dotenv` va después, las vars llegan tarde.

Mismo patrón que `aditus-bpm/app/worker/worker.mjs:13`. En dev local sigue leyendo `.env`, sin
cambio de comportamiento.

### 3. `Dockerfile.worker:37` — el archivo debe llamarse `.env`

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/.env.production ./.env
```

(reemplaza `COPY --from=builder /app/.env.production ./.env.production`)

Se suma el `--chown` porque el proceso corre como `nextjs`, no como root.

### 4. `.gitlab-ci.yml` — levantar el worker en `deploy_master`

Reemplazar el `script` de `deploy_master` (líneas 95-98):

```yaml
    - docker pull $IMAGE_ARG:$CI_COMMIT_REF_NAME
    - docker pull $IMAGE_ARG:$CI_COMMIT_REF_NAME-worker
    - cd /home/desarrollo/compose
    - docker compose -f docker-compose-aditus.yml pull aditus-rrhh aditus-rrhh-worker
    - docker compose -f docker-compose-aditus.yml up -d aditus-rrhh aditus-rrhh-worker
```

**No se tocan `deploy_develop` ni `deploy_demo`.** Los tres environments comparten el mismo
`DATABASE_URL` (verificado en las CI/CD vars de GitLab), así que un segundo worker competiría por
la misma cola. El worker corre **solo en master**.

## Cambios — repo `infra`

### 5. `docker-compose-aditus.yml` — nuevo servicio

Después de `aditus-rrhh` (termina en la línea 93):

```yaml
  aditus-rrhh-worker:
    container_name: aditus-rrhh-worker_compose
    hostname: aditus-rrhh-worker_compose
    image: gitlab-dev.grupolpa.com:5050/apps/gestion-rrhh:master-worker
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
    stop_grace_period: 60s
```

Tres decisiones y su razón:

- **Sin `ports`** — no expone nada (ver la aclaración de arriba).
- **Sin `environment`** — los secrets viajan dentro del `.env` de la imagen, materializado por el
  CI. Mismo criterio que `aditus-rrhh`.
- **Tag `master-worker`, sin `command`** — a diferencia de `aditus-bpm-worker`, que reusa la
  imagen web con otro `CMD`, acá el worker es una **imagen distinta** (`Dockerfile.worker`: corre
  con `tsx`, sin build de Next).
- **`stop_grace_period: 60s`** — Docker manda `SIGKILL` 10s después del `SIGTERM` por defecto.
  El `shutdown()` de `worker/index.ts:32` espera a que terminen los jobs en vuelo; con 10s, un job
  largo muere a la mitad y queda `CLAIMED` hasta que `reclaimStale` lo recupere 15 minutos después.

El `deploy-job` del `.gitlab-ci.yml` de infra ya copia el compose al host cuando detecta cambios
en ese archivo.

## Orden de ejecución

1. Cambios 1-4 en `gestion-rrhh`, commit en `master` — **sin pushear todavía**.
2. Cambio 5 en `infra`, commit y push. Esperar a que su pipeline copie el compose al host.
3. Recién ahí, push de `master` en `gestion-rrhh`.

**Si se invierte 2 y 3**, `docker compose up -d aditus-rrhh-worker` falla con "no such service" y
el deploy se cae — arrastrando también el `up` de `aditus-rrhh`, porque van en el mismo comando.

## Verificación

**Local, antes de pushear:**

- `npm run worker` → loguea `worker starting` con `workerId`. Confirma que el import nuevo no rompe.
- En otra terminal, `npm run worker:enqueue-ping` → el worker debe tomar el job `PING` y dejarlo
  en `DONE`.
- `docker build -f Dockerfile.worker -t rrhh-worker-test .` y `docker run --rm rrhh-worker-test`
  → confirma que `dotenv` levanta el `.env` de adentro de la imagen. Si `DATABASE_URL` no cargara,
  Prisma tira error explícito en el primer query, no falla en silencio.

**En el servidor, después del deploy:**

1. `docker compose -f /home/desarrollo/compose/docker-compose-aditus.yml logs -f aditus-rrhh-worker`
   → `worker starting`. Esto prueba **solo** que el env cargó; no prueba que el SFTP funcione.
2. Prueba de cola: `npm run worker:enqueue-ping` **desde la máquina local** — como los tres
   `DATABASE_URL` son idénticos, el job cae en la misma tabla y lo toma el worker de producción.
3. Prueba real, la única concluyente: dejar un PDF en `/Download/Recibos` del SFTPGo y seguirlo
   → aparece un job `INGEST_SFTP` en `JobQueue`, pasa a `DONE`, y queda el registro en
   `SftpArchivoProcesado`.
4. Prueba del graceful shutdown: redeploy con un job en vuelo → en los logs tienen que aparecer
   `shutdown` y el cierre del runner **antes** de que muera el contenedor.

Query de control:

```sql
SELECT estado, COUNT(*) FROM JobQueue GROUP BY estado;
```

`CLAIMED` acumulándose = jobs que mueren a la mitad.

## Si el watcher no conecta

La config SFTP **no sale del env**: sale de la tabla `GeneralConfig` (una sola fila), columnas
`sftpEnabled`, `sftpHost`, `sftpPort`, `sftpUser`, `sftpPassword`, `sftpIncomingPath`,
`sftpProcessedPath`, `sftpErrorsPath`, `sftpPollIntervalMinutes`, `sftpStableSeconds`. La lee
`worker/sftpWatcher.ts:45` y la **relee cada 60 segundos**, así que cambiar la config no necesita
redeploy.

Trampa a tener presente: si la config está incompleta, `configCompleta()` devuelve false y el loop
gira **sin loguear nada**. El worker parece sano y no hace nada. Por eso el log de arranque no
alcanza como verificación.

Para validar credenciales sin guardarlas: `POST /api/configuracion/sftp/test` (solo ADMIN).

Sobre red: `sftpHost` es `sftpgo.aditus-dev.com.ar`, un nombre DNS público, y el puerto `4101` es
el que publica el host. No hace falta agregar el contenedor a una red dedicada de Docker.

## Fuera de alcance a propósito

- **El plan de aislamiento** (`docs/worker-aislamiento-plan.md`): el worker importa `sonner` a
  través de `src/lib/recibosDetect.ts`. Es un problema real de arquitectura, pero **no bloquea
  este deploy** — hoy funciona porque ese código nunca se ejecuta del lado del worker. Conviene
  hacerlo después, no antes.
- Worker en develop o demo (comparten `DATABASE_URL` con producción).
- Endpoint `/health` y monitoreo.
- Rotación de logs, pese a que `sftpPollIntervalMinutes = 1` genera bastante volumen.
