Std is `.doo` modules under `std/` plus FFI packages (`packages/`). Import `std::Name` and call `Name::fn` or imported symbols. Built-in methods on `Str`/`[T]`/`{K:V}` are not duplicated in std.

## Math (`std/Math.doo`)

```doo
import std::Math::{Abs, Min, Max, Sqrt, Floor};

fn main() {
    print(Abs(-5));
    print(Min(10, 20), Max(10, 20));
    print(Sqrt(16));
    print(Floor(3.0));
}
```

Also `Pow(base, exponent)`, `Ceil`, `Round`. `Sqrt`/`Pow` in this module take `Int`. `Floor`/`Ceil`/`Round` take `Float` and return `Int`.

## Array utilities (`std/Array.doo`)

```doo
import std::Array::*;

fn main() {
    print(Unique([1, 2, 2, 3]));
    print(Sum([1, 2, 3]));
    print(Range(0, 5));
}
```

`MinArr` / `MaxArr` on `[Int]`. Instance methods (`push`, `map`, …) stay on the value.

## File (`std/File.doo`) — all `@extern("doo_file", ...)`

```doo
import std::File;

fn ProcessFile() -> Str ! FileError {
    let content = File::Read("data.txt")?;
    File::Write("output.txt", content)?;
    Ok content;
}

fn main() {
    File::Write("test.txt", "Hello")?;
    let content = File::Read("test.txt")?;
    print(content);
    if File::Exists("./dir") { File::RmDirAll("./dir")?; }
    File::MkDir("./dir")?;
}
```

Also `Append`, `Delete`, `Size`, `Metadata`, `ListDir`, `Copy`, `Move`, `ReadLines`, `RmDir`. Errors are `FileError { Message: Str }`.

## Config

```doo
import std::Config;

fn main() {
    let port = Config.getInt("PORT", 3100);
    let debug = Config.getBool("DEBUG", false);
    print(port, debug);
}
```

`DATABASE_URL` and `JWT_SECRET` are read by `Database::Postgres()` and `app.auth()` without `Config::get`.

## JSON, Process, Git, Random

```doo
print(JSON.stringify(42));
let n: Int = JSON.parse(JSON.stringify(99));

import std::Process::{Process, ProcessError};
let out = Process::output("echo", "[\"hello\"]")?;

import std::Git;
Git::init(repoDir)?;
let hash = Git::commitAll(repoDir, "msg", "Dev", "dev@example.com")?;

import std::Random; // Random.string(len) via runtime FFI
```

HTTP, Database, Auth are separate topics; they are still `import std::Http::Server` style modules.
