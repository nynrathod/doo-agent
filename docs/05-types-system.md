Doo is statically typed with inference. Core types are `Int`, `Float`, `Bool`, `Str`, `Void`, `nil`, arrays `[T]`, maps `{K: V}`, structs, enums (unit and payload), tuples, `T?` option, and Result `T ! E`. Visibility is PascalCase public vs camelCase private.

## Annotations and inference

```doo
fn main() {
    let intVal: Int = 42;
    let floatVal: Float = 3.14;
    let strVal: Str = "hello";
    let boolVal: Bool = true;
    let arrInt: [Int] = [1, 2, 3];
    let mapSI: {Str: Int} = {"a": 1, "b": 2};
}
```

Unannotated `let` infers from the initializer. Function parameters and returns are explicit.

## Structs

```doo
struct User {
    id: Int @primary @auto,
    email: Str @email @unique,
    password: Str @hash @min(8) @max(20),
    age: Int @min(18),
}

fn main() {
    let user = User { name: "Alice", email: "alice@doo.dev", age: 25 };
}
```

Field names in literals must match the struct. Extra fields fail type checking.

Validated field decorators (compiler `DecoratorValidator`): `@email`, `@url`, `@min(n)`, `@max(n)`, `@pattern(regex)`, `@primary`, `@auto` / `@autoIncrement`, `@unique`, `@foreign(Struct)`, `@hash`, `@optional`, `@default(value)`, `@readOnly`, `@writeOnly`, `@internal`, `@json`, `@role`, `@owner`. Struct-level: `@table`, `@autoTimestamp`. Enum variants: `@inherits(Other)`.

## Enums

```doo
enum Direction { North, South, East, West }
enum Shape { Circle(Int), Rectangle(Int, Int) }

fn main() {
    let d = Direction::North;
    print(area(Shape::Rectangle(3, 4)));
}
```

## Visibility

Across modules, **PascalCase** types, functions, fields, and consts are public. **camelCase** is private to the defining file. Importers can use `user.Id` but not `user.internalId`.

## Static and const

```doo
static DB: Database;
const MaxUsers = 100;

fn main() {
    DB = Database::Postgres()?;
}
```

`static` is a process-lifetime binding (typical pattern: one `Database` used by HTTP handlers). `const` is compile-time.

## Ownership (compiler, not annotations)

There are no lifetime annotations. The analysis crate decides move / copy / clone / drop from use. Passing a struct into a function does not necessarily invalidate later field reads (`tests/run_pass/ownership/clone_struct.doo`). Concurrent mutation is borrow-checked.

## Option

`T?` and `nil` work with `??` coalescing (`nil ?? "default"`). See error-handling for Result `T ! E`.
