`Str` is a UTF-8 fat pointer (ptr + length). Build strings with literals, `+`, and `"${expr}"` templates. Methods are compiler builtins (`STRING_METHODS` in `doo_core`), not a user-defined type class.

## Interpolation and concat

```doo
fn main() {
    let name = "Alice";
    let age = 30;
    let greeting = "Hello ${name}!";
    let info = "${name} is ${age} years old";
    let math = "10 + 20 = ${10 + 20}";
    print("Welcome to " + name);
    print(greeting, info, math);
}
```

Templates accept nested arithmetic. Empty interpolations are fine (`"Start${empty}End"`).

## Methods (`tests/dev_test/inbuilt/inbuilt_method.doo`)

```doo
fn main() {
    let testStr: Str = "hello world";
    print(testStr.len());
    print(testStr.charAt(0));
    print(testStr.substring(0, 5));
    print(testStr.concat("!"));
    print(testStr.indexOf("world"));
    print("hello".toUpper());
    print("WORLD".toLower());
    print("hello".replace("l", "x"));
    print("  spaces  ".trim());
    print("hello".reverse());
    print("hello".contains("ll"));
    print("hello".startsWith("he"));
    print("hello".endsWith("lo"));
}
```

Also registered: `repeat`, `charCode`, `countSubstr`. Indexing/slicing arrays of strings uses the same `[]` / range syntax as other arrays.

## Unicode

`tests/dev_test/utf8/test_utf8.doo` exercises UTF-8 source and string data. Prefer methods above rather than byte arithmetic.

## Casts

`i as Str`, `f as Str`, `b as Str`, and `"123" as Int` / `"3.14" as Float` are in the type-cast suite. `JSON.stringify` / `JSON.parse` convert structured values to and from JSON text.

There is no `format!` macro. Use interpolation or `+`.
