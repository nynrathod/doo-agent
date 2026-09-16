Doo interfaces are Go-style implicit contracts: a struct satisfies an interface if it has the required methods. Pass the interface as a parameter for polymorphism. There is no `trait` keyword and no explicit `implements`.

## Define and satisfy

Methods may be `fn Type.method(self)` (or `impl` blocks). The receiver type is checked structurally.

```doo
interface Describable {
    fn describe(self) -> Str;
}

struct User {
    Name: Str,
    Age: Int,
}

fn User.describe(self) -> Str {
    return "${self.Name} is ${self.Age} years old";
}

struct Product {
    Title: Str,
    Price: Float,
}

fn Product.describe(self) -> Str {
    return "${self.Title} costs $${self.Price}";
}

fn PrintDescription(item: Describable) {
    print(item.describe());
}

fn main() {
    PrintDescription(User { Name: "Alice", Age: 30 });
    PrintDescription(Product { Title: "Widget", Price: 9.99 });
}
```

## Multiple methods, errors, floats

```doo
interface Calculator {
    fn add(self, a: Int, b: Int) -> Int;
    fn multiply(self, a: Int, b: Int) -> Int;
}

interface Validator {
    fn validate(self, value: Int) -> Bool ! Str;
}

interface Shape {
    fn area(self) -> Float;
    fn perimeter(self) -> Float;
}

fn RangeValidator.validate(self, value: Int) -> Bool ! Str {
    if value < self.Min {
        return Err "value too low: ${value} < ${self.Min}";
    }
    return Ok true;
}

fn CheckWithValidator(v: Validator, val: Int) {
    let result, err = v.validate(val);
    if err != nil {
        print("Validation error:", err);
    } else {
        print("Validation passed:", result);
    }
}
```

`tests/dev_test/interface/main.doo` covers Int/Float/Bool/Str params and returns, fallible methods, and several structs sharing one interface. Call methods on the interface value: `item.describe()`, `calc.add(x, y)`.
