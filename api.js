/*
 * QuickNotes API client
 * Talks to the JSONPlaceholder practice API (https://jsonplaceholder.typicode.com).
 * All user-supplied or server-supplied text is inserted with textContent only,
 * never innerHTML, so it cannot inject markup or scripts into the page.
 */

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const NOTES_LIMIT = 10;

const loadBtn = document.getElementById("load-btn");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const notesList = document.getElementById("notes-list");

/* ---------- Helpers ---------- */

// type is one of: "loading", "success", "error" (each has its own CSS style)
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type || "";
}

// Disable every button while a request is running so nothing is sent twice.
function setBusy(isBusy) {
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.disabled = isBusy;
  });
}

// Reusable request helper: calls fetch, checks response.ok, throws on errors.
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error(`Server responded with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (parseError) {
    data = null; // some successful responses (e.g. DELETE) may have no useful body
  }
  return { data, status: response.status };
}

// Turn a technical error into a message a person can understand.
function friendlyError(error, action) {
  if (error.status) {
    return `Could not ${action}: the server returned an error (status ${error.status}). Please try again.`;
  }
  return `Could not ${action}: please check your internet connection and try again.`;
}

/* ---------- Rendering ---------- */

function showEmptyState() {
  const item = document.createElement("li");
  item.className = "empty-state";
  item.textContent = 'No notes to show. Click "Load notes" or add one below.';
  notesList.appendChild(item);
}

function removeEmptyState() {
  const empty = notesList.querySelector(".empty-state");
  if (empty) {
    empty.remove();
  }
}

function renderNote(note) {
  const item = document.createElement("li");
  item.dataset.id = note.id;

  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = note.title;

  const body = document.createElement("p");
  body.className = "note-body";
  body.textContent = note.body;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  // Pass the <li> itself (not just the id) so we remove exactly this note.
  deleteBtn.addEventListener("click", () => deleteNote(note, item));

  item.append(title, body, deleteBtn);
  return item;
}

function renderNotes(notes) {
  notesList.replaceChildren();

  if (notes.length === 0) {
    showEmptyState();
    return;
  }
  notes.forEach((note) => notesList.appendChild(renderNote(note)));
}

/* ---------- GET: load notes ---------- */

async function getNotes() {
  const { data } = await request(`${API_URL}?_limit=${NOTES_LIMIT}`);
  if (!Array.isArray(data)) {
    throw new Error("Unexpected response from the server");
  }
  return data;
}

async function loadNotes() {
  setBusy(true);
  setStatus("Loading notes...", "loading");

  try {
    const notes = await getNotes();
    renderNotes(notes);

    if (notes.length === 0) {
      setStatus("The server returned no notes.", "success");
    } else {
      const plural = notes.length === 1 ? "" : "s";
      setStatus(`Loaded ${notes.length} note${plural} from the server.`, "success");
    }
  } catch (error) {
    setStatus(friendlyError(error, "load notes"), "error");
  } finally {
    setBusy(false);
  }
}

loadBtn.addEventListener("click", loadNotes);

/* ---------- POST: create a note ---------- */

const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const MAX_TITLE_LENGTH = 100;

// Returns an error message, or an empty string when the title is valid.
function validateTitle(title) {
  if (title.length === 0) {
    return "Please enter a title for your note.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `The title is too long (${title.length} characters). Please use ${MAX_TITLE_LENGTH} or fewer.`;
  }
  return "";
}

async function postNote(note) {
  return request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(note),
  });
}

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim(); // the body is optional

  const validationError = validateTitle(title);
  if (validationError) {
    setStatus(validationError, "error");
    titleInput.focus();
    return;
  }

  setBusy(true);
  setStatus("Creating note...", "loading");

  try {
    const { data, status } = await postNote({ title, body, userId: 1 });

    removeEmptyState();
    createdInThisSession.add(data); // remember it was never really stored (see DELETE notes)
    notesList.prepend(renderNote(data)); // newest note goes to the top
    noteForm.reset();
    setStatus(`Note created (status ${status}, id ${data.id}).`, "success");
  } catch (error) {
    // The form is NOT cleared on failure, so the user does not lose their text.
    setStatus(friendlyError(error, "create the note"), "error");
  } finally {
    setBusy(false);
  }
}

noteForm.addEventListener("submit", createNote);

/* ---------- DELETE: remove a note ---------- */

/*
 * HOW DELETE WORKS WITH A FAKE API
 * JSONPlaceholder does not really store anything. A POST returns a fake note
 * (always id 101) and a DELETE replies "200 OK" without changing any data.
 * That means:
 *   1. We must NOT re-fetch the list after deleting: the server would simply
 *      send the "deleted" note back. Instead, once the server confirms the
 *      DELETE succeeded, the page itself removes the note, so the screen is
 *      the source of truth for this session.
 *   2. Notes created with POST never existed on the server. A real API would
 *      answer 404 when we try to delete them, so a 404 for a note we created in
 *      this session is treated as "already gone" and the note is removed.
 *   3. Because every POST returns id 101, several created notes can share an
 *      id. We therefore remove the exact <li> that was clicked, not "the note
 *      with this id".
 * With the real QuickNotes backend, the server would be the source of truth
 * and the same code would work without these workarounds.
 */
const createdInThisSession = new WeakSet();

async function deleteNoteRequest(id) {
  return request(`${API_URL}/${id}`, { method: "DELETE" });
}

async function deleteNote(note, listItem) {
  setBusy(true);
  setStatus(`Deleting note ${note.id}...`, "loading");

  try {
    await deleteNoteRequest(note.id);
    listItem.remove();
    setStatus(`Note ${note.id} deleted.`, "success");
  } catch (error) {
    if (error.status === 404 && createdInThisSession.has(note)) {
      listItem.remove(); // never stored on the server, so it is already gone
      setStatus(`Note ${note.id} removed (it only existed in this page).`, "success");
    } else {
      setStatus(friendlyError(error, `delete note ${note.id}`), "error");
    }
  } finally {
    setBusy(false);
    if (notesList.children.length === 0) {
      showEmptyState();
    }
  }
}
