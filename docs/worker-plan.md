# Desplegar el worker de gestion-rrhh en GitLab CI/CD + infra

## Contexto

`gestion-rrhh` ya tiene un worker (`worker/index.ts`) que corre el watcher SFTP y consume la
tabla `JobQueue`. El CI **ya construye y pushea** la imagen `:$CI_COMMIT_REF_NAME-worker`
(`Dockerfile.worker`) y la usa para el stage `migrate`, pero **nadie la corre**: no hay servicio
en `docker-compose-aditus.yml` ni job de deploy que la levante. Además, el worker no carga
`.env.production` (no hay `import 'dotenv/config'` en ningún lado y `tsx` no lo hace solo), así
que hoy arrancaría sin `DATABASE_URL` ni `ADITUS_*`.

`aditus-bpm` ya resolvió exactamente esto: `import 'dotenv/config'` en el worker, `.env`
materializado por el CI dentro de la imagen, y un servicio `aditus-bpm-worker` en el compose que
reusa la misma imagen con `command` distinto. Replicamos ese patrón.

**Decisiones tomadas con el usuario:** el worker corre **solo en producción (master)**. Develop
comparte `DATABASE_URL` con prod y dos workers competirían por la misma cola; demo queda fuera
por ahora.

## Cambios

### Repo `C:\Aditus\gestion-rrhh`

**1. `package.json` — declarar `dotenv`**
Hoy está solo como dependencia transitiva de Prisma. Agregarlo a `dependencies`
(`npm install dotenv`) para que `npm ci` en el Dockerfile lo garantice.

**2. `worker/index.ts` — cargar el env**
Primer import del archivo, antes de `./jobRunner` y `./sftpWatcher` (que arrastran
`@/lib/prisma` y `@/lib/aditus`, los cuales leen `process.env` en import time):

```ts
import 'dotenv/config'
```

Igual que `aditus-bpm/app/worker/worker.mjs:13`. En dev local sigue leyendo `.env`, sin cambios
de comportamiento.

**3. `Dockerfile.worker` — el archivo debe llamarse `.env`**
`dotenv/config` busca `./.env`, no `.env.production`. En el stage `runner`, cambiar

```dockerfile
COPY --from=builder /app/.env.production ./.env.production
```

por

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/.env.production ./.env
```

(el CI ya materializó los placeholders con `sed` antes del build, igual que para la imagen web).

**4. `.gitlab-ci.yml` — levantar el worker en `deploy_master`**
Agregar el pull de la imagen `-worker` y el `pull`/`up` del nuevo servicio, junto al de la web:

```yaml
    - docker pull $IMAGE_ARG:$CI_COMMIT_REF_NAME
    - docker pull $IMAGE_ARG:$CI_COMMIT_REF_NAME-worker
    - cd /home/desarrollo/compose
    - docker compose -f docker-compose-aditus.yml pull aditus-rrhh aditus-rrhh-worker
    - docker compose -f docker-compose-aditus.yml up -d aditus-rrhh aditus-rrhh-worker
```

El `docker pull $IMAGE_ARG:$CI_COMMIT_REF_NAME` suelto que hay hoy queda redundante con el
`docker compose pull` — sacarlo (punto 5 del review).

No se toca `deploy_develop` ni `deploy_demo`.

### Repo `C:\Aditus\infra\infra`

**5. `docker-compose-aditus.yml` — nuevo servicio**
Inmediatamente después de `aditus-rrhh` (línea ~85), replicando la forma de
`aditus-bpm-worker` (líneas 75-83) pero apuntando al tag `-worker` en lugar de usar `command`,
porque en rrhh el worker es una **imagen distinta** (`Dockerfile.worker`, con `tsx` y sin build
de Next) y no una variante de CMD sobre la imagen web:

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

Sin `ports` (no expone nada) y sin `environment` (los secrets viajan en el `.env` de la imagen).

**`stop_grace_period: 60s` no es opcional.** El shutdown del worker es graceful — `worker/index.ts`
espera a que `stopJobs()` termine el job en curso — pero el default de Docker es mandar SIGKILL a
los 10s. Un `INGEST_SFTP` que está bajando un PDF del SFTP y subiéndolo a Aditus tarda más que eso:
muere a mitad, el job queda `claimed` y espera 15 minutos a que `reclaimStale` lo libere
(`worker/jobRunner.ts:35`). Sin el grace period eso pasa en cada deploy.
El `deploy-job` de `.gitlab-ci.yml` de infra ya copia el compose al host al detectar cambios en
`docker-compose-aditus.yml`, así que basta con mergear a la rama que dispara ese job.

## Chequeos previos (bloqueantes)

Supuestos que cambian el resultado, verificados el 2026-09-07. **Los tres están cerrados y
ninguno bloquea** — quedan documentados porque dos de ellos cambian decisiones del plan.

**A. ¿`sftpEnabled` está en true, con credenciales y paths cargados? — ✅ VERIFICADO (2026-09-07).**
`GeneralConfig` tiene `sftpEnabled=true`, usuario `demo-recibos` con password seteada,
`sftpIncomingPath=/Download/Recibos`, `sftpProcessedPath=/Download/Procesados`,
`sftpErrorsPath=/Download/Errores`. El watcher va a tener con qué trabajar apenas arranque.

**B. ¿El `sftpHost` es alcanzable desde el contenedor? — ✅ VERIFICADO (2026-09-07): sí.**
`sftpHost=sftpgo.aditus-dev.com.ar`, `sftpPort=4101`. Es un **nombre DNS público**, no el nombre de
un contenedor, así que resuelve por DNS normal y **no hace falta sumar la red dedicada de SFTPGo**
al servicio del worker. Además el puerto coincide con el que publica el host en
`infra/sftpgo/compose-sftpgo.yml` (`"4101:2022"`). El `extra_hosts: host-gateway` del servicio queda
por consistencia con el resto del compose, pero no es lo que resuelve el acceso al SFTP.

**El worker ya fue ejercitado end-to-end:** `JobQueue` tiene 24 jobs, todos en estado `DONE`. El
riesgo de "la primera corrida real es en producción" no aplica.

**Dos cosas para confirmar antes del deploy (no bloquean, pero conviene decidirlas):**

- `sftpPollIntervalMinutes=1` — un poll por minuto, ~1440 ciclos por día, cada uno con su línea de
  log. Es un valor de testing. Si se deja, **agregar rotación de logs al servicio** (el resto del
  compose no la tiene, pero ninguno de esos servicios loguea en loop):
  ```yaml
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
  ```
- El usuario SFTP es `demo-recibos`. Confirmar que sea el que corresponde en producción y no un
  usuario de prueba heredado.

**C. ¿La `DATABASE_URL` de `development` apunta a la misma base que `production`? — ✅ VERIFICADO
(2026-09-07): sí, y `demo` también.**
Las CI/CD vars de `apps/gestion-rrhh` tienen tres filas de `DATABASE_URL` (una por environment),
pero el valor es **idéntico byte por byte en las tres**. Mismo host, misma base.

Esto convierte "worker solo en master" en **obligatorio, no una preferencia**: un worker en develop
o demo competiría por la misma tabla `JobQueue` que el de producción y `claim()` los haría pelear
por los mismos jobs. No agregar el servicio a `deploy_develop` ni a `deploy_demo` bajo ninguna
circunstancia mientras las tres vars compartan valor.

> **Fuera del alcance de este plan, pero conviene saberlo:** por lo mismo, `migrate_develop` y
> `migrate_demo` (`.gitlab-ci.yml:69-91`) corren los scripts de migración **contra la base de
> producción**, y `aditus-rrhh-demo` sirve datos productivos. Hoy no rompe porque los scripts son
> idempotentes (`IF NOT EXISTS`), pero la red de seguridad es esa disciplina, no el aislamiento.

**Nota menor:** las CI/CD vars `INFRA_CONFIG_BASE_URL`, `INFRA_B2B_*` e `INFRA_DOMAIN` están
cargadas en GitLab y en `.env.example`, pero ningún archivo de `src/` ni `worker/` las lee, y
tampoco están en el `sed` del CI ni en `.env.production`. Leftover de otro proyecto del ecosistema;
no afectan al worker.

## Orden de ejecución

0. Guardar este plan en `docs/worker-plan.md` del repo `gestion-rrhh` (pedido explícito del
   usuario; no puedo escribirlo mientras dure el plan mode).
1. Cambios 1-4 en `gestion-rrhh` → commit en `master`.
2. Cambio 5 en `infra` → commit y push (el pipeline copia el compose al host).
3. Recién entonces correr el pipeline de `gestion-rrhh` en `master` — si se invierte el orden,
   `docker compose up -d aditus-rrhh-worker` falla por servicio inexistente.

## Verificación

**Local (antes de pushear):**
- `npm run worker` → debe loguear `worker starting` y no romper por el import nuevo.
- `npm run worker:enqueue-ping` en otra terminal → el worker debe tomar el job `PING`.
- `docker build -f Dockerfile.worker -t rrhh-worker-test .` con un `.env.production` de prueba,
  luego `docker run --rm rrhh-worker-test` → confirma que `dotenv` levanta el `.env` de la imagen
  (si `DATABASE_URL` no cargara, Prisma tira error explícito al primer query).

**En el servidor (después del deploy):**
- `docker compose -f /home/desarrollo/compose/docker-compose-aditus.yml logs -f aditus-rrhh-worker`
  → `worker starting` con `workerId`, y ciclos del watcher cada `sftpPollIntervalMinutes`.
  Ojo: este log **no** prueba que el worker sirva para algo — con `sftpEnabled=false` sale igual.
  Por eso el chequeo A es previo.
- Dejar un PDF en la carpeta `sftpIncomingPath` del SFTPGo y confirmar que aparece un job
  `INGEST_SFTP` en `JobQueue` y luego el registro en `SftpArchivoProcesado`. **Esta es la única
  verificación que realmente cierra el circuito.**
- Redeploy de prueba (`docker compose up -d aditus-rrhh-worker` de nuevo) mientras hay un job en
  curso → confirmar en los logs el `shutdown` + `runner stopped` antes de que muera el contenedor,
  y que el job quedó `completed` y no colgado.

## Rollback

El worker es independiente de la web: nada del front depende de que esté vivo, solo se dejan de
consumir jobs y de pollear el SFTP (los jobs quedan encolados y se procesan cuando vuelva).

```bash
docker compose -f /home/desarrollo/compose/docker-compose-aditus.yml stop aditus-rrhh-worker
```

Si hay que volver a una imagen anterior, cambiar el tag del servicio en el compose de `infra` y
re-deployar. Los cambios 1-3 en `gestion-rrhh` son inertes para la imagen web (solo tocan
`worker/index.ts` y `Dockerfile.worker`), así que no hace falta revertir la app para apagar el
worker.
