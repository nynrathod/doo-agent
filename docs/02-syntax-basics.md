Doo uses `let` / `let mut` bindings, C-like operators, `"${expr}"` interpolation, and `print(...)`. Integers, floats, booleans, and strings are first-class; comments are `//`.

## Bindings

```doo
fn main() {
    let name = "Alice";
    let age: Int = 25;
    let mut count = 0;
    count = count + 1;
    const AppName = "doo";
    const IsEnabled = true;
    print(name, age, count, AppName, IsEnabled);
}
```

`const` is a compile-time value (Int, Float, Str, Bool, array, map). PascalCase consts are public across modules; camelCase consts stay private to the file.

## Primitive types

| Type | Literal |
| --- | --- |
| `Int` | `42` |
| `Float` | `3.14` |
| `Str` | `"hello"` |
| `Bool` | `true` / `false` |
| `[T]` | `[1, 2, 3]` |
| `{K: V}` | `{"a": 1}` |

## Operators

Arithmetic: `+ - * / %` and compound `+= -= *= /= %=`. Increment: `++ --`. Comparison: `== != < > <= >=`. Logic: `&& || !`. Unary minus on ints works (`const MinValue = -10`).

```doo
fn main() {
    print(5 > 3);
    print(5 == 5);
    print(10 % 3);
    let mut n = 1;
    n++;
    print(n);
}
```

## Strings and output

Concatenation is `+`. Interpolation evaluates expressions inside `${}`:

```doo
fn main() {
    let name = "Alice";
    let age = 30;
    print("Hello ${name}!");
    print("${name} is ${age} years old");
    print("10 + 20 = ${10 + 20}");
    print("Welcome to " + name);
}
```

`print` takes one or more arguments and prints them space-separated.

## Casts

```doo
fn main() {
    let i = 42;
    let f = i as Float;
    print(f);
    print("123" as Int);
    print(3.14 as Int);
    print(true as Int);
}
```

Allowed primitive casts include Int↔Float, numeric→Str, Str→Int/Float when the text parses, Bool→Int/Str. Use `typeOf(x)` in diagnostics (see `tests/dev_test/type_handle/`).
