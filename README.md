# DatoCMS Migrator
Compare two DatoCMS environments to generate migration code

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/jbordoe/datocms-migrate/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/jbordoe/datocms-migrate/tree/main)
[![Coverage Status](https://coveralls.io/repos/github/jbordoe/datocms-migrate/badge.svg?branch=main)](https://coveralls.io/github/jbordoe/datocms-migrate?branch=main)

## Run

Ensure the `DATO_READONLY_API_TOKEN` environment variable is set

```bash
node scripts/generate_migration.js --source envA --target envB
```
The generated code will be written to STDOUT.
