Functions are `fn name(params) -> Ret { ... }`. Fallible functions add `! ErrorType`. Expression bodies use `=>`. Methods attach with `fn Type.method(self)` or `impl Type { ... }`. Closures are `(x) => expr` with type `fn(T) -> U`.

## Declarations and returns

Infallible functions use `return`. Fallible functions use `Ok` / `Err` instead of `return` for the Result:

```doo
fn typedAdd(a: Int, b: Int) -> Int {
    return a + b;
}

fn Divide(a: Int, b: Int) -> Int ! Str {
    if b == 0 {
        Err "division by zero";
    }
    Ok a / b;
}

fn AlwaysFails() -> ! Str {
    Err "always fails";
}

fn DoSomething() {
    print("done");
}
```

## Expression functions and tuples

```doo
fn exprInt(x: Int, y: Int) -> Int => x + y;

fn GetBasicTypes() -> Int, Float, Bool, Str {
    return 42, 3.14, true, "hello";
}

fn tupleAdd(x: Int, y: Int) -> Int, Int => x + y, x + y;
```

Callers unpack with `let a, b = ...` (same pattern as Result `let v, e = ...`).

## Methods: `Type.method` and `impl`

```doo
struct User {
    name: Str,
    email: Str,
    age: Int,
}

impl User {
    fn isAdult(self) -> Bool {
        return self.age >= 18;
    }
    fn greet(self) -> Str {
        return "Hello, " + self.name;
    }
}

struct Point {
    x: Int,
    y: Int,
}

fn Point.distance(self) -> Float {
    return Float.parse("" + (self.x * self.x + self.y * self.y));
}
```

Both styles coexist. Enums can have methods the same way (`fn Priority.label(self) -> Str`).

## Closures

```doo
fn applyToAll(items: [Int], action: fn(Int) -> Int) -> [Int] {
    let mut result: [Int] = [];
    for item in items {
        result.push(action(item));
    }
    return result;
}

fn callTwice(action: fn() -> Int) -> [Int] {
    return [action(), action()];
}

fn main() {
    let doubled = applyToAll([1, 2, 3], (x) => x * 2);
    let squared = applyToAll([1, 2, 3], (x) => {
        let result = x * x;
        return result;
    });
    let counter = callTwice(() => 42);
    print(doubled, squared, counter);
}
```

Array `map` / `filter` / `reduce` take the same lambda shape.
