Doo has no `#[test]` runner. The language is tested as **compiler fixtures**: `.doo` files that must parse, type-check, run, or fail, plus Rust unit tests per crate. Feature files can assert stdout with `// EXPECT:` or `// OUTPUT:`.

## How a .doo test works

`tests/run_pass/` programs print values; the harness compares stdout to `// OUTPUT:` lines:

```doo
// OUTPUT: true
// OUTPUT: false
fn main() {
    print(5 > 3);
    print(5 < 3);
}
```

`tests/dev_test/` uses `// EXPECT:` (see `run_features_test.sh`): each line after `EXPECT:` must match stdout. Files without EXPECT are `doo check` only (servers that call `app.start()` would hang).

```bash
doo run tests/dev_test/generics/main.doo
doo check tests/dev_test/http/7_auto_json.doo
bash tests/dev_test/run_features_test.sh -v
```

## Suites (`tests/mod.rs`)

| Suite | Meaning |
| --- | --- |
| `compile_pass` | Must compile |
| `compile_fail` | Must fail (type/scope/safety) |
| `run_pass` | Compile + run + stdout |
| `ui` | Diagnostic text |
| `crashes` | Must not ICE |
| `unit::frontend/hir/mir/codegen/analysis` | Rust stage tests |
| `ffi` | FFI crates |
| `memory_leak` / `stress` | Runtime hygiene |
| `dev_test` | Language + HTTP/DB/async features |

```bash
cargo test --workspace
cargo test --test mod compile_pass
cargo test --test mod compile_fail
cargo test --test mod run_pass
cargo test --test mod unit::frontend::lexer_tests
```

HTTP/DB tests often pair `.doo` with a `.sh` that curls the server (`tests/dev_test/http/`). Query builder tests need PostgreSQL and `DATABASE_URL`.

## Asserting in application code

Use `print` + EXPECT in fixtures. Production apps check Results with `?` / `let v, e =` and HTTP status via curl or an external client — there is no in-language `assert!` suite in this repo.

When adding a language feature, add a `tests/dev_test/` or `run_pass` file rather than a Doo unit-test framework.
