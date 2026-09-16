The HTTP stack is `std::Http::Server`: bind an address, register `get`/`post`/`put`/`patch`/`delete`, optional middleware, then `app.start()`. Handlers may return structs (auto JSON), `Str`, `Response`, or `! Error`. Path `:id` binds to handler params or a path struct.

## Minimal server

```doo
import std::Http::Server;

fn GetPublicInfo() -> MessageResponse {
    return MessageResponse { message: "This is public information" };
}

struct MessageResponse {
    message: Str,
}

fn main() {
    let app = Server::new(":3000");
    app.get("/public", GetPublicInfo);
    app.start();
}
```

Expression handlers: `fn intHandler(p: IntPath) -> Str => "hello + ${p.id}";` with `app.get("/api/users/int/:id", intHandler)`.

## CRUD, groups, logger

```doo
import std::Http::Server;
import std::Database;

fn main() {
    let db = Database::Postgres()?;
    let app = Server::new(":3000")
        .logger({ Level: "Warn, Error" });

    app.crud("/todos", Todo, db);
    app.get("/tasks/urgent", GetUrgent);

    app.group("/api", {
        get("/profile", GetUserProfile),
        post("/users", CreateUser),
        get("/users/:id", GetUser),
    });
    app.start();
}
```

`crud` registers GET list, POST, GET/:id, PUT/:id, DELETE/:id. `Request` has `Method`, `Path`, `Body`, `ContentType`, and `req.header("Authorization")`.

## Middleware

```doo
fn LogMiddleware(req: Request, next: Next) -> Response {
    print(req.Method + " " + req.Path);
    let res = next.call();
    return res;
}

fn main() {
    let app = Server::new(":3109")
        .use(LogMiddleware, TimingMiddleware, CorsMiddleware);
    app.get("/status", GetStatus);
    app.get("/protected", AuthMiddleware, GetProtected);
    app.start();
}
```

Also `.cors(...)`, `.ratelimit(...)`, `.metrics()`, route-level `Jwt()`.

## Fetch and WebSocket

```doo
let res = Fetch("http://127.0.0.1:3190/data");
let res2 = Fetch("http://127.0.0.1:3190/echo", {
    method: "POST",
    body: "hello-world",
    headers: ["Content-Type: application/json"],
    timeout: 5
});

fn echoHandler(conn: WsConnection) {
    conn.on("echo", onEchoMessage);
}
// app.ws("/echo", echoHandler);  conn.emit / join / app.toRoomEmit
```

`tests/dev_test/http/` and `websocket/` are the working corpus.
