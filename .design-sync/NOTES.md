# design-sync notes — RRHH app

## Scope decision (why this repo syncs only `ui/` + `shared/`)

`rrhh_temp` is a full Next.js 16 app (private, no `main`/`module`/`exports` — not a
publishable package), so the converter runs in **synth-entry mode**: no `dist/`, no
shipped `.d.ts`. `cfg.srcDir` points at a staged combined root
(`.design-sync/.cache/ds-src/`, built by `.design-sync/stage-src.sh`, see below) that
contains only copies of `src/components/ui/` and `src/components/shared/`.

**Do not widen `srcDir`/the staged copy to the rest of `src/components`.** Confirmed by
direct experiment: components under `admin/`, `ausencias/`, `calendario/`,
`configuracion/`, `dashboard/`, `documentos/`, `empleado(s)/`, `evaluaciones/`,
`formularios/`, `layout/` (`AdminHeader`/`AdminSidebar`), `licencias/`, `lotes/`,
`perfil/`, `portal/`, `providers/`, `solicitudes/`, `usuarios/` transitively import
`next/navigation` / `next/link`. The synth entry bundles **every** file under `srcDir`
into one shared IIFE (`export * from <every file>`, independent of
`componentSrcMap` — that field only trims the *named-component* list, never which
files get bundled). Next.js's client router reads `process.env.__NEXT_*` and
`process.nextTick` at module scope, assuming Next's own webpack DefinePlugin/shims —
outside the real app these are undefined and the **entire bundle** throws at load,
breaking all 167 components at once (not just the router-touching ones). This is not
fixable via config: it would need a `next/navigation` mock injected in
`lib/bundle.mjs`'s esbuild plugins, which is one of the two files this skill forbids
forking (`lib/emit.mjs`/`lib/bundle.mjs` are the app-contract surface). `layout/`
(AdminHeader/AdminSidebar) fails standalone too, isolated from the rest — confirmed by
a scoped test, not just contamination.

`src/components/shared/AvatarUpload.tsx` is the one exception *inside* the synced
scope: it calls `useRouter()` unconditionally at render time (not inside an event
handler). It's a **permanent floor card** — no preview can be authored for it (there is
no router context in the static preview environment, and no per-component way to shim
one). Don't re-flag this on future syncs; it's expected forever unless the component
itself is refactored to lazy-load the router or accept it as a prop.

## Re-sync risks (what can silently go stale)

- **`cfg.cssEntry` / `cfg.extraFonts` point at hash-named Next.js build output**
  (`.design-sync/.cache/generated-tailwind.css` is a **copy** of
  `.next/static/chunks/<hash>.css`; `extraFonts` points directly at
  `.next/static/chunks/<hash>.css` for the Poppins `@font-face` rules). Both hashes
  change on every `next build`. **On every re-sync**: run `npm run build` (it's fine
  that this OOMs during the TypeScript-check phase on this machine with default heap —
  the CSS/JS chunks are already written to `.next/static/` by the time that happens;
  don't chase the OOM), find the largest `.next/static/chunks/*.css` (Tailwind output)
  and the one containing `@font-face`/`Poppins` (font output), re-copy the former into
  `.design-sync/.cache/generated-tailwind.css`, and update `cfg.extraFonts` to the new
  font chunk's path if it changed name.
- **`.design-sync/stage-src.sh` must be re-run before every build** (it's `cfg.buildCmd`)
  — it stages fresh copies of `src/components/ui/` + `src/components/shared/` into
  `.design-sync/.cache/ds-src/`. If a component file changes in the real source, the
  staged copy is stale until this re-runs.
- **Any new file added to `src/components/ui/` or `src/components/shared/`** gets swept
  into the synth entry unconditionally on the next build. Before adding new files to
  either folder, sanity-check they don't import `next/navigation`, `next/router`,
  `next/link`, or other framework-runtime-only APIs at module/render scope — one such
  file breaks the *entire* shared bundle again (see scope decision above), not just
  itself.
- **Never run a full `package-build.mjs` concurrently with anyone's scoped
  `preview-rebuild.mjs`/`package-capture.mjs`** — it `rm -rf`s and rewrites
  `ds-bundle/` including `.stories-map.json`, which scoped `package-capture.mjs` hard-requires
  and will fail/stall waiting on. Always do the full rebuild *before* fanning out
  parallel authoring work, not concurrently with it — the one time this repo's sync
  did it the other way around, every in-flight scoped agent blocked on
  `[CONFIG_STALE]`/`[NO_MANIFEST]` until the full rebuild finished.

## Base UI (`@base-ui/react`) gotchas — this DS uses Base UI, not Radix

- `Menu.GroupLabel` (→ `DropdownMenuLabel`) **throws** `"Base UI: MenuGroupContext is
  missing"` unless it's inside a `<Menu.Group>` (`DropdownMenuGroup`) or
  `<Menu.RadioGroup>`. A standalone `<DropdownMenuLabel>` outside any group crashes the
  whole open-menu preview. Fixed in `.design-sync/previews/DropdownMenu*.tsx` by
  wrapping the label inside the first `DropdownMenuGroup`.
- Static/open-by-default preview pattern confirmed across every overlay root in this
  DS: `Dialog`/`AlertDialog`/`Select`/`Menu` (dropdown) roots all accept `defaultOpen`;
  `Dialog`/`Select`/`Menu` (not `AlertDialog` — `modal` is omitted from its prop type)
  also accept `modal={false}` to avoid scroll-lock/focus-trap complications in a static
  capture. `Menu.SubmenuRoot` (`DropdownMenuSub`) also takes `defaultOpen` to force a
  nested submenu open.
- The package import for previews is `import { X } from "rrhh_temp"` (matches
  `cfg.pkg`) — resolves to `window.RrhhDS` via the story-imports plugin. Confirmed
  authoritative (read `lib/story-imports.mjs`), not a workaround.
- Preview wrapper markup (rows/columns you invent for layout) must use inline
  `style={{...}}`, never new Tailwind utility classNames — the shipped
  `generated-tailwind.css` only contains classes the real app already uses somewhere;
  an invented class silently does nothing. Component-native classes (already in real
  source) are always safe.

## Known render warns (checked, benign — don't re-chase on future syncs)

`[RENDER_THIN]` "DOM content present but rendered height is 0px" on `ConfirmDialog`,
`ArchivoPreviewDialog`, `BloqueoEliminacionDialog`, `CambiarPasswordDialog` — all four
are `cardMode:"single"` dialogs using `position:fixed`/portal content. The measured
"0px" is the render-check's height heuristic tripping on fixed-position content
escaping normal layout flow; the actual screenshots show full, complete, correctly
styled dialogs (visually confirmed for all four during grading). Non-blocking
(`bad:false` in every case).

## Config overrides in place (cardMode / viewport)

- `Dialog`, `AlertDialog`, and all their subcomponents, plus `ConfirmDialog`:
  `cardMode:"single", viewport:"480x420"`.
- `DropdownMenu` family (15 names) and `Select` family (10 names):
  `cardMode:"single"`; DropdownMenu needed `viewport:"380x460"` (the full open menu +
  open submenu + destructive item didn't fit in the initially-tried `360x340` — it got
  clipped, confirmed by screenshot, then fixed by bumping the height).
  Select family kept `viewport:"360x340"`.
- `Table` family (8 names): `cardMode:"column"` (wide component).
- `Pagination`: `cardMode:"column"` (renders wider than a grid cell).
- `ArchivoPreviewDialog`, `CambiarPasswordDialog`: `cardMode:"single", primaryStory:"Default"`.
- `BloqueoEliminacionDialog`: `cardMode:"single", primaryStory:"ConCascada"` (the richer
  of its two exports).

## Status as of this sync

All 84 in-scope components (85 total minus `AvatarUpload`'s permanent floor card)
authored and graded `good`. `package-validate.mjs`: 85/85 previews render cleanly, 0
blocking errors, 4 known/benign warns (see above). Not yet uploaded to claude.ai/design
— this session had no `/design-login` authorization; upload is pending the user running
that from an interactive session.
