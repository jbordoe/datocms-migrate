# DatoCMS Migrator
Compare two DatoCMS environments to generate migration code

## Run

Ensure the `DATO_READONLY_API_TOKEN` environment variable is set

```bash
node scripts/generate_migration.js --source envA --target envB
```
The generated code will be written to STDOUT.
