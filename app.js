"use strict";

const STORAGE_KEY = "gratitude.entries.v1";

const form = document.getElementById("entry-form");
const input = document.getElementById("entry-text");
const list = document.getElementById("entries");
const emptyState = document.getElementById("empty-state");
const template = document.getElementById("entry-template");
const settingsDialog = document.getElementById("settings-dialog");
const reminderTime = document.getElementById("reminder-time");
const importFile = document.getElementById("import-file");

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

let entries = loadEntries();
let editingId = null;

// ---------- storage ----------

function loadEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function isValidEntry(e) {
  return (
    e &&
    typeof e.id === "string" &&
    typeof e.text === "string" &&
    typeof e.createdAt === "string" &&
    !Number.isNaN(Date.parse(e.createdAt))
  );
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------- rendering ----------

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Today";
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return date.getFullYear() === today.getFullYear() ? dayFormat.format(date) : dayYearFormat.format(date);
}

function sortedEntries() {
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function render() {
  list.replaceChildren();
  emptyState.hidden = entries.length > 0;

  let currentKey = null;
  let group = null;
  for (const entry of sortedEntries()) {
    const created = new Date(entry.createdAt);
    const key = dayKey(created);
    if (key !== currentKey) {
      currentKey = key;
      group = document.createElement("section");
      group.className = "day-group";
      const heading = document.createElement("h2");
      heading.textContent = dayLabel(created);
      group.append(heading);
      list.append(group);
    }
    group.append(entry.id === editingId ? renderEditor(entry) : renderEntry(entry));
  }
}

function renderEntry(entry) {
  const node = template.content.firstElementChild.cloneNode(true);
  const created = new Date(entry.createdAt);
  node.dataset.id = entry.id;
  node.querySelector(".entry-text").textContent = entry.text;
  const time = node.querySelector(".entry-time");
  time.dateTime = entry.createdAt;
  time.textContent = timeFormat.format(created);
  time.title = fullFormat.format(created);
  if (entry.updatedAt) {
    const edited = node.querySelector(".entry-edited");
    edited.hidden = false;
    edited.title = `Edited ${fullFormat.format(new Date(entry.updatedAt))}`;
  }
  return node;
}

function renderEditor(entry) {
  const node = document.createElement("article");
  node.className = "entry";
  node.dataset.id = entry.id;

  const textarea = document.createElement("textarea");
  textarea.value = entry.text;
  textarea.rows = Math.max(3, entry.text.split("\n").length);
  textarea.setAttribute("aria-label", "Edit moment");

  const actions = document.createElement("div");
  actions.className = "edit-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.dataset.action = "cancel";
  cancel.textContent = "Cancel";
  const save = document.createElement("button");
  save.type = "button";
  save.dataset.action = "save";
  save.className = "primary";
  save.textContent = "Save";
  actions.append(cancel, save);

  node.append(textarea, actions);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  return node;
}

// ---------- actions ----------

function addEntry(text) {
  entries.push({ id: newId(), text, createdAt: new Date().toISOString() });
  saveEntries();
  render();
}

function updateEntry(id, text) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  if (entry.text !== text) {
    entry.text = text;
    entry.updatedAt = new Date().toISOString();
    saveEntries();
  }
  editingId = null;
  render();
}

function deleteEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  saveEntries();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addEntry(text);
  input.value = "";
  input.blur();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) form.requestSubmit();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const article = button.closest(".entry");
  const id = article.dataset.id;

  switch (button.dataset.action) {
    case "edit":
      editingId = id;
      render();
      break;
    case "cancel":
      editingId = null;
      render();
      break;
    case "save": {
      const text = article.querySelector("textarea").value.trim();
      if (text) updateEntry(id, text);
      break;
    }
    case "delete":
      if (confirm("Delete this moment? This can't be undone.")) deleteEntry(id);
      break;
  }
});

// ---------- settings: reminder ----------

document.getElementById("menu-button").addEventListener("click", () => settingsDialog.showModal());

// Each option points at a pre-built file in reminders/ (see scripts/generate-reminders.mjs).
const REMINDER_DEFAULT = "2100";
const reminderLink = document.getElementById("reminder-link");

for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
  const hhmm = `${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}`;
  const option = new Option(timeFormat.format(new Date(2000, 0, 1, 0, minutes)), hhmm);
  option.selected = hhmm === REMINDER_DEFAULT;
  reminderTime.append(option);
}

reminderTime.addEventListener("change", () => {
  reminderLink.href = `reminders/${reminderTime.value}.ics`;
});

// ---------- settings: backup ----------

document.getElementById("export-button").addEventListener("click", async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const data = JSON.stringify({ app: "gratitude", version: 1, entries: sortedEntries() }, null, 2);
  const file = new File([data], `gratitude-backup-${stamp}.json`, { type: "application/json" });
  await shareOrDownload(file);
});

document.getElementById("import-button").addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  importFile.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = (Array.isArray(parsed) ? parsed : parsed.entries || []).filter(isValidEntry);
    const known = new Set(entries.map((e) => e.id));
    const added = incoming.filter((e) => !known.has(e.id));
    entries.push(...added);
    saveEntries();
    render();
    alert(`Imported ${added.length} moment${added.length === 1 ? "" : "s"}.`);
  } catch {
    alert("That file couldn't be read as a Gratitude backup.");
  }
});

// Use the native share sheet on phones (lets you save to Files / Calendar / Drive),
// otherwise fall back to a regular download.
async function shareOrDownload(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------- startup ----------

render();

// Refresh "Today"/"Yesterday" labels when the app is reopened on a later day.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && editingId === null) render();
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
