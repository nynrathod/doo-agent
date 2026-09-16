Compilation is Source → Tokens → AST → HIR → typed/analyzed HIR → MIR → LLVM IR → native binary. `doo_driver` `compile.rs` is the orchestrator. Runtime is a native process plus `doo_ffi_runtime` (Tokio) for HTTP/`go`/`scope`.

## Stages

1. **Lexer** (`doo_frontend/lexer`) — keywords (`fn`, `let`, `match`, `go`, …), operators, `"${}"` templates, integers/floats.
2. **Parser** (`doo_frontend/parser`) — AST: items, stmts, exprs, types.
3. **HIR** (`doo_hir`) — desugar (`+=`, `++`, `1..10` → range), attach types, **monomorphize** generics.
4. **Analysis** (`doo_analysis`) — name resolution, type check, decorator validation, error-flow (`?`/`Ok`/`Err`), exhaustiveness, import cycles, field visibility, **ownership** (move/copy/clone/drop, no user lifetimes), borrow check, AST transforms (route groups, inline closures).
5. **MIR** (`doo_mir`) — blocks, instructions, terminators; pure ownership IR (no RC in user semantics).
6. **Codegen** (`doo_codegen`) — LLVM types/instructions, builtins (string/array/map/json), FFI declarations, optimize, object file, link.

`doo_core` holds the type registry, error codes, interned symbols. `doo_diagnostics` emits spanned errors.

## Debug the pipeline

```bash
doo build file.doo --print-ast --print-hir --print-mir --keep-ll --timings
doo check .
```

`--keep-ll` retains LLVM IR. `--keep-obj` keeps the object file. Diagnostics use `doo_core` error codes; `doo --explain CODE` prints the long form.

Driver analysis wiring (`compile.rs`): `TypeChecker`, `DecoratorValidator`, `ErrorFlowChecker`, `ExhaustivenessChecker`, `OwnershipAnalyzer`, `DropInserter`, `BorrowChecker`, `check_field_visibility`, then `transform_inline_closures` / `transform_route_groups`.

## Runtime model

- Output is a **native executable**, not a VM.
- **Auto ownership**: analyzer inserts clones/drops; MIR/codegen implement them.
- **FFI**: `@extern` symbols linked from `ffi/` crates; HTTP server, DB pool, git, process, files.
- **Async**: one global multi-threaded Tokio runtime; `sleep`/`go`/`scope`/`app.start()` use it. No panics across the C ABI (`catch_unwind` in runtime FFI).
- **Std in the binary**: Doo std/`packages` compile with the program; native `.so`/libs ship next to `doo`.

Crate purposes stay split: frontend never emits LLVM; codegen never parses source. Changing AST requires checking HIR → analysis → MIR → codegen.
