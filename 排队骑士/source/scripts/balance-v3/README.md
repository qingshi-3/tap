# Balance v3 deterministic comparison

This harness freezes the current working-tree simulation modules under
`baseline/` before production balance values change. Run labels always resolve
`baseline` from that snapshot and `after` from the live production modules.

Commands (from `source/`):

```powershell
npx vite-node scripts/balance-v3/run.ts baseline 80
npx vite-node scripts/balance-v3/run.ts after 80
npx vite-node scripts/balance-v3/compare.ts
```

The strategy, seed formula, enemies, and group definitions must remain unchanged
between baseline and after. The baseline manifest records hashes of every frozen
source and the Git/worktree state used to create it.
