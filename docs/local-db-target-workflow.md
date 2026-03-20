# Local DB Target Workflow

Use separate local env files for preview and production database targets.

Required files:

- `.env.local`
  - Keep shared local secrets here.
  - Do not rely on it for the active database target.
- `.env.db.preview.local`
  - Set `XD_POSTGRES=<preview database connection string>`
- `.env.db.production.local`
  - Set `XD_POSTGRES=<production database connection string>`

The repo includes `scripts/with-db-target.sh` to inject the correct database URL for a command without editing `.env.local` each time.

Examples:

```bash
npm run db:status:preview
npm run db:deploy:preview
npm run db:status:production
npm run db:deploy:production
```

You can also run arbitrary commands:

```bash
./scripts/with-db-target.sh preview npx prisma studio
./scripts/with-db-target.sh production npx prisma migrate status
./scripts/with-db-target.sh preview next dev
```

Safety notes:

- The wrapper unsets legacy `DATABASE_URL` before executing the command.
- The wrapper fails if `XD_POSTGRES` is missing from the selected target file.
- Preview and production database commands should be treated as explicit choices, not a shared default.
