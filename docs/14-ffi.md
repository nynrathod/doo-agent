FFI is declared in Doo with `@extern("library", "symbol")` and implemented in standalone Rust crates under `ffi/`. The compiler emits calls and type conversions; it does not generate SQL, HTTP handlers, or business logic.

## Declare a binding

From `std/File.doo`:

```doo
struct FileError {
    Message: Str,
}

@extern("doo_file", "doo_file_read")
fn Read(path: Str) -> Str !FileError {}

@extern("doo_file", "doo_file_write")
fn Write(path: Str, content: Str) -> Void !FileError {}

@extern("doo_file", "doo_file_exists")
fn Exists(path: Str) -> Bool {}
```

Bodies are empty: the symbol lives in the native library. `@extern("library")` can auto-derive the symbol (`packages/http/Http.doo` comments). Namespaces are marker structs plus associated fns:

```doo
struct Process {}

@extern("doo_process", "doo_process_run")
fn Process.run(cmd: Str, args_json: Str) -> Str ! ProcessError {}
```

Call as `Process::run(...)` / `File::Read(...)`.

## Crate map

| Crate | Library id (typical) | Role |
| --- | --- | --- |
| `doo_ffi_core` | config, memory, RFC 7807 | Shared FFI |
| `doo_ffi_file` | `doo_file` | Filesystem |
| `doo_ffi_http` | HTTP | Server, fetch, WS, CRUD |
| `doo_ffi_db` | `doo_db` | PostgreSQL |
| `doo_ffi_auth` | `doo_auth` | JWT, bcrypt, OAuth |
| `doo_ffi_json` | JSON | parse/stringify |
| `doo_ffi_process` | `doo_process` | Spawn/run |
| `doo_ffi_git` | `doo_git` | libgit2 |
| `doo_ffi_runtime` | runtime | Tokio, `go`/`scope`/`sleep` |

Packages in `packages/*.doo` are the Doo-facing signatures. Compiler `doo_codegen` links FFI and passes struct metadata (fields, decorators) into init; crates build behavior from that metadata.

## Rules that matter when writing Doo

- Types on `@extern` fns must match the Rust ABI the crate exports (Str, Int, Bool, structs, Result `! E`).
- Null/invalid inputs are handled in the crate, not by generated stubs.
- `?` still works on `! E` FFI returns (`File::Read(...)?`).

Do not put SQL strings or route tables in the compiler; put them in Doo source or in the FFI crate.
