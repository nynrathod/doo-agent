Concurrency is `async fn`, `await`, `sleep(ms)`, fire-and-forget `go { }`, awaitable `let task = go { }`, and structured `scope { go { ... } ... }` that waits for inner tasks. A global Tokio runtime in `doo_ffi_runtime` executes HTTP and `go` work.

## Sleep and async functions

```doo
async fn fetchUser() -> Str {
    sleep(40);
    return "Alice";
}

fn main() {
    sleep(50);
    await sleep(50);
    let user = await fetchUser();
    print("user = ${user}");
}
```

`await` on a call waits for the async result. Sequential `await` chains run one after another.

## go blocks

```doo
fn main() {
    go {
        print("detached task running");
    }
    sleep(100);

    let task = go {
        sleep(30);
        print("task with handle done");
    };
    sleep(100);
}
```

`go { }` without binding detaches. Nested `go` is allowed (`tests/compile_pass/async/nested_go.doo`).

## Structured concurrency with scope

`scope` waits until every nested `go` finishes. Shorter sleeps completing first is the test for real parallelism:

```doo
fn main() {
    scope {
        go {
            sleep(60);
            print("A done (60ms)");
        }
        go {
            sleep(20);
            print("B done (20ms)");
        }
    }
    print("scope exited — all tasks finished");
}
```

You can `await` imported `async fn`s inside `go` inside `scope`. Mix ordinary CPU work with `await sleep`.

## Loops

```doo
fn main() {
    for i in 0..3 {
        await sleep(20);
        print("poll iteration ${i}");
    }
}
```

Keywords `async`, `await`, `go`, `scope` are in the lexer. Do not treat this as OS threads you spawn and join manually; use `scope` for join, `go` for spawn.
