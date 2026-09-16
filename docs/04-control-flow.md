Control flow is `if` / `else if` / `else`, `for x in collection` or `for i in start..end`, `break` / `continue`, and `match` with `_` default. Nested loops and expression-valued `match` are supported.

## If / else

```doo
fn main() {
    let x = 10;
    if x < 5 {
        print("x is less than 5");
    } else if x == 10 {
        print("x is 10");
    } else {
        print("x is greater than 5 but not 10");
    }
}
```

Conditions are `Bool`. Combine with `&&` and `||`.

## For ranges and collections

Ranges are half-open `start..end` (desugared in HIR). Iterate arrays with `for item in arr`.

```doo
fn main() {
    for i in 1..10 {
        if i > 3 {
            break;
        }
        print(i);
    }

    let fruits = ["apple", "banana", "cherry"];
    for fruit in fruits {
        print(fruit);
    }

    let mut last = 0;
    for i in 0..100 {
        if i % 2 == 0 { continue; }
        if i >= 5 { break; }
        last = i;
    }
    print(last);
}
```

`continue` and `break` are only legal inside loops (compile-fail otherwise). Nested `for` works:

```doo
fn main() {
    let mut count = 0;
    for i in 0..3 {
        for j in 0..3 {
            count++;
        }
    }
    print(count);
}
```

## Match

`match` is exhaustive with `_` as wildcard. Use it as a statement or an expression.

```doo
fn main() {
    let x = 2;
    let result = match x {
        1 => "one",
        2 => "two",
        3 => "three",
        _ => "other",
    };
    print("Result:", result);

    match x {
        1 => print("It's one"),
        2 => print("It's two"),
        _ => print("It's something else"),
    }
}
```

Match enum payloads by binding fields:

```doo
enum Shape {
    Circle(Int),
    Rectangle(Int, Int),
}

fn area(s: Shape) -> Int {
    match s {
        Shape::Circle(r) => r * r,
        Shape::Rectangle(w, h) => w * h,
    }
}
```

The analysis crate checks exhaustiveness on enum matches.
