# Feature flags

The flags live in [`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts) and are read through
`isFeatureEnabled(flag)`. This page is the reference for what each flag means, which environment
variable drives it, and what it actually changes today.

## The matrix

| Flag | Environment variable | Default | Intended surface | Gates today |
|---|---|---|---|---|
| `MULTI_ASSET` | `NEXT_PUBLIC_FEATURE_MULTI_ASSET` | on — off only when the value is exactly `false` | multi-asset support (USDC, custom tokens) | none: no route or component reads this flag yet |
| `RECURRING_PAYMENTS` | `NEXT_PUBLIC_FEATURE_RECURRING` | on — off only when the value is exactly `false` | recurring payment scheduler | none: no route or component reads this flag yet |
| `WEBHOOKS` | `NEXT_PUBLIC_FEATURE_WEBHOOKS` | on — off only when the value is exactly `false` | webhook delivery | none: no route or component reads this flag yet |
| `ADVANCED_ANALYTICS` | `NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS` | **off — on only when the value is exactly `true`** | advanced analytics | none: no route or component reads this flag yet |
| `API_KEYS` | `NEXT_PUBLIC_FEATURE_API_KEYS` | on — off only when the value is exactly `false` | API key management | none: no route or component reads this flag yet |

Two things in that table are easy to get wrong, so they are called out here:

1. **The defaults are not uniform.** Four flags are enabled unless you explicitly set the string
   `false`; `ADVANCED_ANALYTICS` is disabled unless you explicitly set the string `true`. An unset
   variable is therefore not the same as "off" for four of the five flags. "Why is this page
   missing?" is usually this asymmetry rather than a bug.
2. **"Gates today" is not the same as "intended surface".** No route, page or component currently
   calls `isFeatureEnabled`, so toggling a flag changes no behaviour yet — the routes that the
   flags were named for (`/recurring`, `/webhooks`, `/analytics`) are served unconditionally.
   `src/__tests__/feature-flags-docs.test.ts` derives the consumer list from the source tree, so
   this column fails the build if a flag gains its first consumer and the table is not updated
   with it.

## Development override (localStorage, dev only)

In development you can flip a flag without touching the environment:

```js
localStorage.setItem("ff_WEBHOOKS", "false"); // disable
localStorage.removeItem("ff_WEBHOOKS");       // fall back to the environment value
```

The key is `ff_<FLAG_NAME>` — the `ff_` prefix comes from
`STORAGE_KEYS.FEATURE_FLAG_PREFIX` in [`src/lib/storage-keys.ts`](../src/lib/storage-keys.ts).
`overrideFeatureFlag(flag, value)` writes the same key.

The override is **development-only** and deliberately so:

- `isFeatureEnabled` only consults `localStorage` when `process.env.NODE_ENV === "development"`,
  so a production bundle ignores it entirely;
- it is also skipped when `window` is undefined, so server rendering and API routes always use the
  environment value;
- the value must be the exact string `"true"` or `"false"`; anything else falls through to the
  environment default.

## Changing a flag in a deployment requires a rebuild

Every flag variable is `NEXT_PUBLIC_*`, and Next.js **inlines** those values at build time. They are
not read from the environment at runtime:

- Setting `NEXT_PUBLIC_FEATURE_*` in a container's environment, a Kubernetes ConfigMap or a Helm
  `config:` block on a prebuilt image has **no effect** — the bundle already carries the value that
  was present during `next build`.
- To change a flag for a release you must build the image with the variable set. The Helm and
  `k8s/` manifests list these keys only so their key set matches `.env.example`
  (`src/__tests__/helm-config.test.ts` enforces that); their comments carry the same warning.
- Variables marked `NEXT_PUBLIC_` are also visible in the client bundle. Do not put secrets behind
  a flag name.

## Adding a flag

1. Add the entry to `FEATURE_FLAGS` in `src/lib/feature-flags.ts`, with the JSDoc line that states
   what it is for.
2. Add the variable to `.env.example` (the `Feature Flags` block) so the documented set stays
   complete — `helm-config.test.ts` and `feature-flags-docs.test.ts` both read that file.
3. Add a row to the matrix above, including the default and the code paths the flag gates. If the
   flag is not consumed yet, say so rather than describing the intended surface in the "Gates
   today" column.
4. Consume it with `isFeatureEnabled("<FLAG>")` rather than reading `process.env` directly, so the
   dev override keeps working.
