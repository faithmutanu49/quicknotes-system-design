# QuickNotes API Design

This document describes the **real QuickNotes REST API** that the backend team should build for 1 million users. It is *not* the JSONPlaceholder practice API used by the front-end demo in `index.html` / `api.js` (see [Differences from the practice API](#7-differences-from-the-practice-api)).

- **Base URL:** `https://api.quicknotes.example/v1`
- **Format:** JSON requests and responses (`Content-Type: application/json; charset=utf-8`)
- **Authentication:** `Authorization: Bearer <access_token>` on every endpoint except register and login
- **Timestamps:** ISO 8601, always UTC (e.g. `2026-10-15T07:30:12Z`)

---

## 1. Design principles

| Principle | How QuickNotes applies it |
|---|---|
| Resources are nouns | `/notes`, `/tags`, never `/getNotes` or `/createNote` |
| HTTP methods carry the action | `GET` read, `POST` create, `PUT` replace, `PATCH` partial update, `DELETE` remove |
| Plural, lowercase paths | `/v1/notes/1042` identifies one note in the collection |
| Versioned | `/v1` in the path, so breaking changes can ship as `/v2` without breaking old apps |
| Stateless | Every request carries its own token; any app server can answer it |
| The token identifies the user | The user id is **never** in the URL, so a user cannot ask for someone else's notes by editing a path |
| Safe retries | `GET`, `PUT` and `DELETE` are idempotent; `POST /notes` accepts an optional `Idempotency-Key` header so a retry after a dropped mobile connection does not create a duplicate note |
| Pagination everywhere | Lists use cursor pagination (`limit` + `cursor`), never "return everything" |
| Consistent errors | One error body shape for every failure (see section 5) |

---

## 2. Endpoint summary

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | `POST` | `/v1/auth/register` | Create a new account (email + password) | `201 Created` |
| 2 | `POST` | `/v1/auth/login` | Exchange email + password for an access token | `200 OK` |
| 3 | `GET` | `/v1/notes` | List the current user's notes, newest first. Supports `limit`, `cursor`, `tag` and `q` (search) | `200 OK` |
| 4 | `POST` | `/v1/notes` | Create a note (title required, body and tags optional) | `201 Created` |
| 5 | `GET` | `/v1/notes/{id}` | Fetch one note | `200 OK` |
| 6 | `PUT` | `/v1/notes/{id}` | Replace a note completely (title, body, tags) | `200 OK` |
| 7 | `PATCH` | `/v1/notes/{id}` | Update only the fields sent (e.g. just the body) | `200 OK` |
| 8 | `DELETE` | `/v1/notes/{id}` | Delete a note (its tag links are removed too) | `204 No Content` |
| 9 | `GET` | `/v1/tags` | List the current user's tags with the number of notes in each | `200 OK` |
| 10 | `DELETE` | `/v1/tags/{id}` | Delete a tag and remove it from every note (the notes themselves are kept) | `204 No Content` |

### Query parameters for `GET /v1/notes`

| Parameter | Type | Default | Meaning |
|---|---|---|---|
| `limit` | integer, 1-50 | 20 | Maximum notes per page |
| `cursor` | string | none | Opaque value copied from the previous response's `meta.next_cursor` |
| `tag` | string | none | Only notes carrying this tag name |
| `q` | string | none | Search text in title and body |

### Field rules for a note

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Set by the server, read-only |
| `title` | string | **Required**, 1-100 characters after trimming |
| `body` | string | Optional, up to 10,000 characters, defaults to `""` |
| `tags` | array of strings | Optional, up to 10 tags, each 1-50 characters |
| `created_at`, `updated_at` | timestamp | Set by the server, read-only |

---

## 3. Request and response examples

### 3.1 Create a note - `POST /v1/notes`

**Request**

```http
POST /v1/notes HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Idempotency-Key: 3f1b8c2e-5a47-4e0b-9d63-1c7a0e9b2f10

{
  "title": "Buy groceries",
  "body": "Sukuma wiki, tomatoes, maize flour",
  "tags": ["shopping", "home"]
}
```

**Response - `201 Created`**

```http
HTTP/1.1 201 Created
Location: /v1/notes/1042
Content-Type: application/json

{
  "id": 1042,
  "title": "Buy groceries",
  "body": "Sukuma wiki, tomatoes, maize flour",
  "tags": ["shopping", "home"],
  "created_at": "2026-10-15T07:30:12Z",
  "updated_at": "2026-10-15T07:30:12Z"
}
```

### 3.2 List notes - `GET /v1/notes?limit=2&tag=shopping`

**Request**

```http
GET /v1/notes?limit=2&tag=shopping HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response - `200 OK`**

```json
{
  "data": [
    {
      "id": 1042,
      "title": "Buy groceries",
      "body": "Sukuma wiki, tomatoes, maize flour",
      "tags": ["shopping", "home"],
      "created_at": "2026-10-15T07:30:12Z",
      "updated_at": "2026-10-15T07:30:12Z"
    },
    {
      "id": 1038,
      "title": "Airtime and data bundles",
      "body": "Top up before Friday",
      "tags": ["shopping"],
      "created_at": "2026-10-14T18:02:01Z",
      "updated_at": "2026-10-14T18:05:44Z"
    }
  ],
  "meta": {
    "limit": 2,
    "has_more": true,
    "next_cursor": "eyJpZCI6MTAzOH0"
  }
}
```

To get the next page the client sends `GET /v1/notes?limit=2&tag=shopping&cursor=eyJpZCI6MTAzOH0`. When `has_more` is `false`, `next_cursor` is `null`. An empty list is still `200 OK` with `"data": []`.

### 3.3 Partial update - `PATCH /v1/notes/1042`

```json
{ "body": "Sukuma wiki, tomatoes, maize flour, cooking oil" }
```

Response `200 OK` returns the full updated note, with a new `updated_at`.

### 3.4 Delete - `DELETE /v1/notes/1042`

Response `204 No Content` with an empty body. Deleting a note that is already gone returns `404`, which clients may treat as success.

---

## 4. Authentication examples

**Register** - `POST /v1/auth/register`

```json
{ "email": "wanjiru@example.com", "password": "a-long-passphrase", "display_name": "Wanjiru" }
```

Response `201 Created`:

```json
{ "id": 7, "email": "wanjiru@example.com", "display_name": "Wanjiru", "created_at": "2026-10-15T07:12:00Z" }
```

**Login** - `POST /v1/auth/login`

```json
{ "email": "wanjiru@example.com", "password": "a-long-passphrase" }
```

Response `200 OK`:

```json
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "token_type": "Bearer", "expires_in": 3600 }
```

---

## 5. Error responses

Every error uses the same body shape so the front end can handle them in one place:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable explanation.",
    "details": [],
    "request_id": "req_8f2a91c4"
  }
}
```

`request_id` is also written to the server logs, so a user can quote it to support.

### 5.1 Status codes the API can return

| Status | Name | When it happens |
|---|---|---|
| `400` | Bad Request | Malformed JSON, missing or invalid field (for example an empty title or a title over 100 characters), bad `limit` or `cursor` |
| `401` | Unauthorized | No token, expired token, invalid token, or wrong email/password at login |
| `403` | Forbidden | The token is valid but the action is not allowed, for example the account is suspended or the email address is not yet verified |
| `404` | Not Found | The note or tag does not exist **or belongs to another user** (the API deliberately does not reveal which) |
| `409` | Conflict | Email already registered, or a duplicate `Idempotency-Key` with a different request body |
| `429` | Too Many Requests | The client exceeded its rate limit; the `Retry-After` header says how many seconds to wait |
| `500` | Internal Server Error | An unexpected bug or failure on the server; the client may retry later |
| `503` | Service Unavailable | The service is overloaded or in maintenance, or the database is temporarily unreachable |

### 5.2 Example error bodies

**400 Bad Request** - validation failure on `POST /v1/notes`

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request body is invalid.",
    "details": [
      { "field": "title", "issue": "must be between 1 and 100 characters" }
    ],
    "request_id": "req_8f2a91c4"
  }
}
```

**401 Unauthorized** - missing or expired token

```json
{
  "error": {
    "code": "invalid_token",
    "message": "Your session has expired. Please log in again.",
    "details": [],
    "request_id": "req_1b7d03aa"
  }
}
```

**403 Forbidden** - valid token, action not allowed

```json
{
  "error": {
    "code": "email_not_verified",
    "message": "Verify your email address before creating notes.",
    "details": [],
    "request_id": "req_5c90e2f7"
  }
}
```

**404 Not Found** - unknown or someone else's note

```json
{
  "error": {
    "code": "note_not_found",
    "message": "No note with id 9999 was found.",
    "details": [],
    "request_id": "req_a43b6d18"
  }
}
```

**500 Internal Server Error** - never leaks internals

```json
{
  "error": {
    "code": "internal_error",
    "message": "Something went wrong on our side. Please try again in a moment.",
    "details": [],
    "request_id": "req_e07f4c92"
  }
}
```

---

## 6. Cross-cutting rules

- **Rate limiting:** 100 requests per minute per user (and a lower limit per IP for register/login). Responses carry `X-RateLimit-Remaining`; exceeding the limit returns `429`.
- **Security:** HTTPS only; passwords stored as salted hashes (Argon2id or bcrypt), never in plain text; access tokens expire after one hour.
- **Ownership:** every query on notes and tags is filtered by the user id taken from the token.
- **Payload size:** requests larger than 64 KB are rejected with `400`. This keeps responses small, which matters on slower mobile connections.
- **CORS:** only the QuickNotes web origin may call the API from a browser.

---

## 7. Differences from the practice API

The demo client talks to JSONPlaceholder (`/posts`), a fake API for learning. The real design above differs in important ways:

| Topic | JSONPlaceholder (demo) | Real QuickNotes API |
|---|---|---|
| Storage | Nothing is saved; `POST` always returns id 101 | Notes are stored in the database with unique ids |
| Delete result | `200 OK` with `{}` | `204 No Content` |
| Ownership | `userId` is sent in the body (`userId: 1`) | The user comes from the access token, never from the body |
| Auth | None | Bearer token on every request |
| Pagination | `_limit=10` | `limit` + opaque `cursor` |
| Errors | Bare status codes | Consistent JSON error body with `request_id` |
