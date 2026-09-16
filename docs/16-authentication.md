Auth is JWT sessions plus optional OAuth. `app.auth(signup, login, User, db)` hashes `@hash` passwords and issues tokens. Protect routes with `Jwt()`. RBAC uses `enum Role`, `@role` / `@owner` fields, and `policy Name for Struct`.

## JWT signup/login and protected routes

User model needs `@primary @auto` id, unique email, hashed password:

```doo
import std::Http::Server;
import std::Database;
import std::Auth::Jwt;

struct User {
    id: Int @primary @auto,
    Email: Str @unique,
    Password: Str @hash,
    Name: Str,
    Role: Str,
}

fn GetProfile(req: Request) -> ProfileResponse {
    return ProfileResponse { id: 1, email: "user@example.com", name: "Test User" };
}

fn main() {
    let db = Database::Postgres()?;
    let app = Server::new(":3100");
    app.auth("/signup", "/login", User, db);
    app.get("/public", GetPublicInfo);
    app.get("/profile", Jwt(), GetProfile);
    app.post("/profile", Jwt(), PostUpdateProfile);
    app.group("/api", Jwt(), {
        get("/profile", GetApiProfile),
        post("/create", PostApiCreate),
    });
    app.start();
}
```

`JWT_SECRET` comes from `.env`. Low-level `signJwt` / `hashPassword` / `verifyPassword` exist on `std::Auth` (`packages/auth/Auth.doo`) if you are not using `app.auth`.

## OAuth (Google, GitHub)

```doo
fn main() {
    let app = Server::new(":3120");
    app.oauth({Providers: ["Google", "GitHub"]});
    app.get("/public", GetPublicInfo);
    app.get("/profile", Jwt(), GetProfile);
    app.start();
}
```

Auto routes: `GET /auth/google`, `GET /auth/google/callback`, same for GitHub. Callbacks establish a JWT session; `Jwt()` works for OAuth users. Webhooks can subscribe to `oauth_login` (`tests/dev_test/webhook/oauth_webhook.doo`).

## RBAC policies

```doo
enum Role {
    Admin @inherits(Editor),
    Editor,
    User,
}

struct User {
    id: Int @primary @auto,
    Email: Str @unique,
    Password: Str @hash,
    Role: Role @role,
}

struct Post {
    id: Int @primary @auto,
    title: Str,
    user_id: Int @owner,
}

policy PostPolicy for Post {
    read:   public,
    create: authenticated,
    update: own | Admin,
    delete: own | Admin,
}
```

Policy verbs: `public`, `authenticated`, `own`, role names, `|` combination. `@inherits` on enum variants widens Admin to Editor privileges (`tests/dev_test/database/rbac/`).
