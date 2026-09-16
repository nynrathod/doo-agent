Fallible functions declare `-> T ! E` and return with `Ok value` / `Err error`. Callers propagate with `?`, unpack with `let v, e = ...` (`e == nil` means success), default with `??`, or abort with `?? panic("msg")`. `main` may use `?` without declaring `! E` (abort).

## Return-type rules

| Signature | Keywords |
| --- | --- |
| `-> T` | `return` |
| `-> T ! E` | `Ok` / `Err` |
| `-> ! E` | `Err` only (error-only function) |
| no `->` | no Ok/Err/return required |

```doo
fn Divide(a: Int, b: Int) -> Int ! Str {
    if b == 0 {
        Err "division by zero";
    }
    Ok a / b;
}

fn GetValue() -> Int {
    return 42;
}

fn AlwaysFails() -> ! Str {
    Err "always fails";
}
```

Error types are ordinary types: `Str`, structs (`FileError { Message: Str }`), or enums (`enum AuthError { Unauthorized, Forbidden }`).

## `?` propagation

```doo
fn getNumber() -> Int ! Str {
    Ok 42;
}

fn processNumber() -> Int ! Str {
    let n = getNumber()?;
    Ok n;
}

fn main() {
    let v, e = processNumber();
    if e == nil {
        print(v);
    } else {
        print("Error:", e);
    }
}
```

If the inner call returns `Err`, `?` returns that error from the current function. Nested `?` chains work (`tests/run_pass/error_handling/nested_result.doo`).

## Manual unpack

```doo
fn TestManualHandling() -> Int ! Str {
    let result, err = Divide(10, 2);
    if err != nil {
        Err err;
    }
    Ok result;
}
```

Calculator example uses the same `let r, e = ...; if e != nil` pattern for `CalcError` structs.

## Nil-coalescing and panic

```doo
fn main() {
    let name1 = nil ?? "default";
    let name2 = "hello" ?? "world";
    let name3 = nil ?? nil ?? "fallback";
    let num1 = nil ?? 42;
}

fn UseCritical() -> Int ! Str {
    let value = GetCriticalValue() ?? panic("Critical value required!");
    Ok value;
}
```

`??` is distinct from `?`. File/DB APIs return `! FileError` / `! DatabaseError`; RFC 7807 problem details are used at the HTTP FFI boundary, not as a Doo keyword.
