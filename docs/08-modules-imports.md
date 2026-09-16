Modules are `.doo` files. `import` pulls std packages, local files, and named symbols. There is no third-party package registry: resolution is files on disk plus `std/` and `packages/` shipped with the compiler (`doo_driver` module loader).

## Import forms (all used in `tests/dev_test/import/all_imports.doo`)

```doo
import std::Math::Abs;
import std::Math::{Min, Max};
import std::Math::{Sqrt as Sq};
import std::Array::*;
import std::File;
import std::Array as Arr;
import std::Math::Floor as Fl;

fn main() {
    print(Abs(-5));
    print(Min(10, 20), Max(10, 20));
    print(Sq(16));
    print(Unique([1, 2, 2, 3]));
    print(File::Read("no_such_file.txt"));
    print(Arr::Sum([1, 2, 3, 4]));
    print(Fl(3.0));
}
```

HTTP/DB/Auth surface as `import std::Http::Server;`, `import std::Database;`, `import std::Auth::Jwt;`. Local modules use the file stem:

```doo
import core::evaluator::*;
import core::error::{CalcError};
import Models::{Task, User};
import Handlers::{GetDone, GetUrgent};
import lib::{MaxRetries, Pi};
```

`import std::io;` and `import std { File as F };` also parse (`tests/compile_pass/imports/`). Nested paths and aliases are supported; circular imports fail in analysis.

## Visibility across files

PascalCase names export; camelCase does not. A file can `import defs::types::{PublicUser, CreateUser}` and read `user.Id`, but a private field `internalId` is a compile error from another module (`tests/dev_test/fixture/visibilitytest/`).

## Where code lives

| Path | Role |
| --- | --- |
| `std/*.doo` | Math, Array, File, Config, Random (Doo + `@extern`) |
| `packages/http`, `db`, `auth`, `process`, `git` | FFI-backed std modules |
| project `.doo` files | Your modules; `main.doo` is the default entry |

Set `DOO_STDLIB_PATH` when the compiler must find `std/` outside the install prefix (DooCloud server does this).

There is no `doo add` / lockfile. Sharing code means copying modules or depending on the std tree that ships with `doo`.
