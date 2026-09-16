Doo is a statically typed language compiled with Rust + LLVM to a native binary. The usual workflow is `doo init` for a template, then `doo run` to compile and execute `main.doo`.

## Install and verify

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/nynrathod/doolang/main/install.ps1 | iex
doo --help
```

Linux / macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/nynrathod/doolang/main/install.sh | bash
doo --help
```

## Start a project

```bash
doo init --template starter starter-api
cd starter-api
doo run
```

`doo init --template blog` generates a posts + comments API. Templates also write `.env` with `DATABASE_URL` and `JWT_SECRET`.

## Minimal program

Entry is `fn main()`. `print` writes to stdout. Types are inferred unless you annotate them.

```doo
fn main() {
    let language = "Doo";
    let year = 2026;
    let ready = true;
    print("Language:", language);
    print("Year:", year);
    print("Production Ready:", ready);

    let message = "Hello from ${language}!";
    print(message);

    let features = ["Type Safe", "Fast", "Stupid Simple"];
    for feature in features {
        print("  -", feature);
    }
}
```

Run a file or the current directory (looks for `main.doo`):

```bash
doo run
doo run examples/hello_world/main.doo
doo build src/main.doo -o output
doo check .
```

Alpha software: syntax and APIs still change. Prefer `tests/dev_test/` and `tests/run_pass/` over marketing snippets when you need working syntax.
