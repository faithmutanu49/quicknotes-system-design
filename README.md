# QuickNotes System Design

QuickNotes is a note-taking app that is moving from a browser-only tool to an online service for **1 million users**. This repository has two parts:

1. **A working API client** (`index.html`, `api.js`, `style.css`) that proves the front end can load, create and delete notes over HTTP. It talks to the free [JSONPlaceholder](https://jsonplaceholder.typicode.com) practice API.
2. **Three design documents** in `docs/` that the backend team can build the real service from: the REST API, the database model and the system architecture.

## Features of the API client

- **Load notes (GET):** fetches 10 notes from `https://jsonplaceholder.typicode.com/posts?_limit=10` and shows each title and body.
- **Create a note (POST):** validates the form (title required, maximum 100 characters, body optional), sends `{ title, body, userId: 1 }`, and adds the returned note to the top of the list.
- **Delete a note (DELETE):** each note has a Delete button that sends `DELETE /posts/{id}` and removes the note when the server confirms.
- **All four states are shown:** loading ("Loading notes..."), success, error (friendly messages) and empty (a message inside the list).
- **Safe by design:** a single reusable `request()` function checks `response.ok` and throws on errors; every call is wrapped in `try` / `catch` / `finally`; buttons are disabled while a request runs; all text is inserted with `textContent`, never as HTML.

## How to run the API client

There is nothing to install or build. You only need a modern browser and an internet connection.

**Option 1 - open the file**

1. Download or clone the repository.
2. Double-click `index.html` (or drag it into your browser).

**Option 2 - run a tiny local server**

```bash
git clone https://github.com/your-username/quicknotes-system-design.git
cd quicknotes-system-design
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

**Try it**

1. Click **Load notes**: you should see "Loading notes...", then "Loaded 10 notes from the server."
2. Type a title (and optionally a body) and click **Create note**: the new note appears at the top with a message such as "Note created (status 201, id 101)."
3. Click **Delete** on any note: it disappears and a confirmation appears.
4. Submit the form with an empty title, or one longer than 100 characters, to see validation errors.
5. Turn off your internet connection and click **Load notes** to see the friendly error message.

> **Note:** JSONPlaceholder is a fake API. It accepts new notes and deletions but does not really store them, so notes you create always get id 101 and reloading the page brings back the original 10. `api.js` explains in a code comment how deletion is handled sensibly under these limits.

## Design documents

| Document | What it covers |
|---|---|
| [docs/api-design.md](docs/api-design.md) | 10 REST endpoints for the real QuickNotes API, request/response examples for creating and listing notes, and the error codes (400, 401, 403, 404, 500 and more) with example error bodies |
| [docs/data-model.md](docs/data-model.md) | The `users`, `notes`, `tags` and `note_tags` tables, relationships, `CREATE TABLE` statements, example SQL queries (including JOINs), indexes, and the SQL vs NoSQL decision |
| [docs/architecture.md](docs/architecture.md) | Functional and non-functional requirements, a load estimate for 1 million users, the architecture diagram, what each component does, the `GET /notes` and `POST /notes` flows, trade-offs and single points of failure |

## Project structure

```
quicknotes-system-design/
├── index.html          # page structure
├── style.css           # styling, including success and error messages
├── api.js              # fetch-based API client (GET, POST, DELETE)
├── README.md
└── docs/
    ├── api-design.md
    ├── data-model.md
    └── architecture.md
```

## What I learned

- **`fetch` does not fail on HTTP errors.** A `404` or `500` still counts as a "successful" request to `fetch`, so I must check `response.ok` and throw myself. Putting this in one reusable `request()` function means every GET, POST and DELETE handles errors the same way.
- **A fake API changes how you think about state.** JSONPlaceholder never saves anything, so re-loading the list after a delete would bring the note back. This taught me the difference between what the server knows and what the page shows, and why a real backend has to be the source of truth.
- **Good API design is about consistency.** Using nouns for resources, the right HTTP verb for each action, correct status codes (`201` for created, `204` for deleted, `404` for not found) and one error format makes an API predictable for the people who use it.
- **Back-of-the-envelope estimates guide the design.** Working out the numbers showed that 1 million users is only about 116 reads per second on average, so the architecture is mainly about reliability and room to grow rather than raw speed.
- **Every layer must be duplicated to avoid single points of failure,** and every speed-up has a price: caches and read replicas make reads fast but can show slightly old data, so I had to plan how users still see their own changes immediately.
- **Never put user text into a page as HTML.** Using `textContent` means a note containing `<script>` is displayed as harmless text instead of being run.
