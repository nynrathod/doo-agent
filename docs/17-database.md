PostgreSQL is `Database::Postgres()` reading `DATABASE_URL`. Structs with `@primary` / `@auto` become tables. Query with `db.raw` / `db.rawWithParams`, or the compile-time query builder `db.find(Model).where(...).exec()`. `doo migrate` diffs models against the live schema.

## Connect and raw SQL

```doo
import std::Database;

struct User {
    id: Int @primary @auto,
    email: Str @unique,
    password: Str @hash,
}

fn GetUrgent() -> [Task] ! DatabaseError {
    let db = Database::get()?;
    let result: [Task] = db.rawWithParams(
        "SELECT * FROM tasks WHERE priority = $1 AND status != $2",
        [Priority::High, Status::Done]
    )?;
    Ok result;
}

fn main() {
    let db = Database::Postgres()?;
    let users = db.raw("SELECT * FROM users")?;
}
```

`raw` / `rawWithParams` return JSON that deserializes to the annotated return type (`[Task]`). Placeholders are `$1`, `$2`. `Database.get()` is the global after `Postgres()`. Handlers often use `static DB: Database;` assigned once in `main`.

## Query builder

```doo
import std::Database;

fn main() {
    let mut db = Database::Postgres()?;

    let sql: Str = db.find(Task)
        .where({ status: "active", priority: Gt(3) })
        .orderBy({ priority: Desc })
        .limit(10)
        .toSql()?;

    let ins: Str = db.insert(Task, {
        title: "Fix login bug",
        status: "active",
        priority: 5,
        user_id: 1,
        description: "Auth service is down"
    }).exec()?;

    let rows: Str = db.find(Task).where({ status: "active" }).exec()?;
    let one: Str = db.findOne(Task).where({ id: 1 }).toSql()?;
    let n: Str = db.count(Task).where({ status: "active" }).toSql()?;
    db.update(Task).set({ status: "done" }).where({ id: 1 }).toSql()?;
    db.delete(Task).where({ status: "archived" }).toSql()?;
}
```

`toSql()` is compile-time SQL with no round-trip; `exec()` runs it. Operators like `Gt` / `Desc` appear in `tests/dev_test/database/query_builder/`.

## CRUD + migrations

`app.crud("/products", Product, db)` plus `app.auth` is the full path in `tests/dev_test/database/auth_crud_full.doo`.

```bash
doo migrate
doo migrate --dry-run
doo migrate --status
doo migrate --rollback 1
doo run --migrate
```

`doo_migrate` extracts structs from source, diffs PostgreSQL, plans SQL. `--force` approves destructive changes. Override URL with `--database-url`.

Decorators that affect schema: `@primary`, `@auto`, `@unique`, `@foreign(User)`, `@default(...)`, `@table`. FFI crate `doo_ffi_db` implements the driver; Doo never embeds generated SQL in the compiler.
