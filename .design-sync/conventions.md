## Using this design system

This is the RRHH app's shadcn/ui-style component set, built on **Base UI**
(`@base-ui/react`) primitives + Tailwind v4 utility classes + `class-variance-authority`
variants — not Radix, not styled-components. No provider/wrapper is required: every
component works standalone once `styles.css` is loaded (which this bundle always
provides). There is no theme object to configure and no context to set up.

**Styling idiom — Tailwind utilities on semantic CSS variables, not raw colors.** Never
write raw hex colors, `red-500`-style raw Tailwind palette classes, or invented utility
classes. Every surface/text/border color is one of this fixed semantic set (defined as
CSS custom properties, consumed via Tailwind utilities):

| Token | Typical utility |
|---|---|
| `background` / `foreground` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | `bg-popover`, `text-popover-foreground` (menus, selects, tooltips) |
| `primary` / `primary-foreground` | `bg-primary`, `text-primary-foreground` (default buttons, checked states) |
| `secondary` / `secondary-foreground` | `bg-secondary` |
| `muted` / `muted-foreground` | `bg-muted`, `text-muted-foreground` (secondary/quiet text, skeletons) |
| `accent` / `accent-foreground` | `bg-accent` (hover/focus states in menus) |
| `destructive` | `bg-destructive`, `text-destructive` (delete/error actions) |
| `border` / `input` / `ring` | `border-border`, `border-input`, `ring-ring` (focus rings) |

Layout/spacing/typography use plain Tailwind (`flex`, `gap-2`, `rounded-lg`, `text-sm`,
`font-medium`) — nothing custom there. Components carry a `data-slot="..."` attribute
(e.g. `data-slot="card-header"`) for structural identification; don't rely on it for
styling, it's not a public API.

**Composition, not configuration.** Components compose like shadcn/ui: a `Card` is
`Card > CardHeader > (CardTitle, CardDescription, CardAction) `, `CardContent`,
`CardFooter` — plain building blocks, not a single component with dozens of props.
Same pattern for `Dialog`/`AlertDialog` (`Trigger` → `Content` → `Header`/`Title`/
`Description` → `Footer`), `Select`/`DropdownMenu` (`Trigger` → `Content` → `Group` →
`Item`/`Label`/`Separator`), and `Table` (`Table` → `TableHeader`/`TableBody`/
`TableFooter` → `TableRow` → `TableHead`/`TableCell`).

**Where the truth lives.** Read `_ds_bundle.css`/`styles.css` for the exact token values
and utility set actually shipped, and each component's own `.d.ts` + `.prompt.md` for
its real prop surface — don't guess a prop exists.

**Example — a realistic composed card** (real component, real tokens, no invented markup):

```tsx
<Card>
  <CardHeader>
    <CardTitle>Ana Gómez</CardTitle>
    <CardDescription>Analista de RRHH</CardDescription>
    <CardAction>
      <Button variant="ghost" size="icon-sm"><MoreVerticalIcon /></Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">Solicitud de licencia pendiente de aprobación.</p>
  </CardContent>
  <CardFooter className="justify-end gap-2">
    <Button variant="outline">Rechazar</Button>
    <Button>Aprobar</Button>
  </CardFooter>
</Card>
```

**Scope note**: this bundle covers only the generic UI kit (`ui/`) and a handful of
shared presentational dialogs (`shared/`) — it does not include this app's business
screens (employee tables, license/leave workflows, dashboards, etc.), which are
page-level features tied to this specific app's data and routing, not reusable design
pieces.
