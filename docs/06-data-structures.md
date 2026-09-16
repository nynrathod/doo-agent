Arrays are `[T]` with `[]` indexing, `start..end` slices, and `...spread`. Maps are `{K: V}` literals with `m[key]` get/set. Built-in methods live in the compiler method registry (`doo_core::methods`).

## Arrays

```doo
fn main() {
    let mut arr: [Int] = [1, 2, 3];
    print(arr.len());
    arr.push(4);
    let popped = arr.pop();
    print(arr[0], arr[arr.len() - 1]);
    arr[1] = 99;

    let mapped = arr.map((x) => x * 2);
    let filtered = arr.filter((x) => x > 2);
    let sum = arr.reduce(0, (a, b) => a + b);
    print(mapped, filtered, sum);

    let nums = [1, 2, 3, 4, 5];
    let slice = nums[1..4];
    let arr2 = [...nums, 6];
    let combined = [...[10, 20], ...[30, 40], 50];
    print(slice, arr2, combined);

    for fruit in ["apple", "banana"] {
        print(fruit);
    }
}
```

Registry methods: `len`, `first`, `last`, `isEmpty`, `push`, `pop`, `contains`, `indexOf`, `sort`, `reverse`, `slice`, `clear`, `join`, `map`, `filter`, `reduce`. Stdlib extras (`import std::Array::*`): `Unique`, `Range`, `Sum`, `MinArr`, `MaxArr` for `[Int]`.

## Maps

```doo
fn main() {
    let mut m = {"name": "Alice", "age": "30"};
    m["city"] = "NYC";
    print(m);

    let mapStrInt: {Str: Int} = {"age": 30, "score": 100};
    let mapIntStr: {Int: Str} = {1: "one", 2: "two"};
    print(mapStrInt, mapIntStr);
}
```

Keys may be `Str`, `Int`, `Float`, or `Bool` in tests. Methods: `has`, `size`, `isEmpty`, `keys`, `values`, `remove`, `clear`. Membership uses `in` in map/array tests (`tests/dev_test/maps/`, `tests/dev_test/find_in/`).

## Tuples

Functions can return multiple values as a tuple type `A, B` (not a `[T]`). Unpack with `let a, b = fn()`.

## JSON round-trip

`JSON.stringify` / `JSON.parse` handle primitives, arrays, maps, structs, and enums (`tests/dev_test/json/main.doo`). HTTP handlers returning structs are serialized automatically.
