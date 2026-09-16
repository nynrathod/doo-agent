The `doo` CLI (`doo_driver`) covers init, check, build, run, migrate, deploy, upgrade, and clean. Global flags: `--debug`, `-W`/`--warn`, `--explain CODE`.

## Project lifecycle

```bash
doo init --template starter my-api
doo init --template blog my-blog
doo check .
doo build . -o output
doo run
doo run path/to/main.doo --verbose
doo clean
doo upgrade
```

`Init` writes template files plus shared `.env` (`DATABASE_URL`, `JWT_SECRET`), `.gitignore`, and a multi-stage Dockerfile that installs the compiler and `doo build -o app`.

## Build / run flags

```bash
doo build src/main.doo -o app --keep-ll --keep-obj --print-ast --print-hir --print-mir --timings
doo run . --keep-ll --debug --verbose --migrate --force
```

`run` compiles, executes, and deletes the temp binary unless you `build`. Trailing args after the path go to the program. `--migrate` applies schema changes before start; `--force` is only valid with migrate.

## Migrate

```bash
doo migrate
doo migrate --dry-run --diff
doo migrate --status
doo migrate --rollback 1
doo migrate --json --database-url postgres://...
```

## Deploy

```bash
doo deploy
doo deploy --verbose
```

Driver implements Fly.io / Railway deploy from the CLI enum. Production images set `DOO_ENV=production` and `LD_LIBRARY_PATH` for FFI `.so` files (template Dockerfile).

## Compiler workspace (contributors)

```bash
cargo build --release --workspace
cargo test --workspace
```

`DOO_STDLIB_PATH` points at `std/` when running a tree that is not the install prefix:

```bash
DOO_STDLIB_PATH=../../doo/std doo run src/main.doo
```

There is no `doo test` subcommand; language tests are Cargo + `.doo` fixtures (see testing doc).
