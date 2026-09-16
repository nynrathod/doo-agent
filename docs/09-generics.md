Generics are type parameters `<T>` on functions and structs. The HIR monomorphizer specializes each used type; duplicate instantiations are deduplicated. Tests cover primitives, tuples, arrays `[T]`, and nested generic calls.

## Functions

```doo
fn identity<T>(x: T) -> T {
    return x;
}

fn makePair<A, B>(a: A, b: B) -> (A, B) {
    return (a, b);
}

fn wrap<T>(x: T) -> T {
    return identity(x);
}

fn first<T>(items: [T]) -> T {
    return items[0];
}

fn main() {
    print(identity(42));
    print(identity("hello"));
    print(identity(true));
    print(identity(3.14));

    let pair = makePair(1, "one");
    print(pair);

    print(wrap(99));
    print(first([10, 20, 30]));
    print(first(["Alice", "Bob"]));
}
```

Call sites do not write turbofish; the compiler infers `T` from arguments.

## Generic structs

```doo
struct Wrapper<T> {
    Value: T,
    Label: Str,
}

fn main() {
    let intBox = Wrapper { Value: 42, Label: "age" };
    print("intBox", intBox.Value);
    let strBox = Wrapper { Value: "hello", Label: "greeting" };
    print(strBox.Value);
}
```

## What exists vs what does not

Evidence in `tests/dev_test/generics/` is monomorphization of functions and structs over primitives and `[T]`. There is no shown syntax for trait bounds (`T: SomeInterface`) on generic parameters. Use `interface` types as parameters for polymorphism instead of bounded generics.

Result types `T ! E` compose with generics in error-handling tests (`tests/dev_test/error_handling/generic.doo`).
