/* =========================================================================
   Flexity demo — the board engine.
   JSON-native model, rendered live. Every mutation flows through history.
   Features: stackable (nested) notes, fold, markdown notes, highlight,
   shadows (pointer refs with pair-hover), note references (inline + picker),
   switch root tray ⇄ column, undo, drag-and-drop, live JSON.

   Element model (board > column > tray > note):
     board  — root; hosts columns + trays
     column — full vertical slot in a board; hosts trays + notes
     tray   — recursively composable; hosts trays + notes
     note   — a markdown slip; stacks with sub-notes but is not a container
   ========================================================================= */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Utilities (declared first — seed() below uses uid before anything else)
  // ---------------------------------------------------------------------
  const uid = (() => { let n = 0; return (p = "id") => `${p}_${Date.now().toString(36)}_${(n++).toString(36)}`; })();
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const STORAGE_KEY = "flexity-demo-v6";
  let state = load() || seed();
  let history = [];
  let redoStack = [];
  const HISTORY_MAX = 60;

  // DOM refs
  const boardEl = document.getElementById("board");
  const boardTitleEl = document.getElementById("board-title");
  const jsonDrawer = document.getElementById("json-drawer");
  const jsonOut = document.getElementById("json-out");
  const toastWrap = document.getElementById("toast-wrap");

  // Assign fresh ids on a cloned subtree (used for seed only).
  function assignIds(node) {
    node.id = uid(node.type);
    (node.children || []).forEach(assignIds);
    return node;
  }

  // Tree search helpers
  function walk(node, fn, parent = null, index = -1) {
    fn(node, parent, index);
    (node.children || []).forEach((c, i) => walk(c, fn, node, i));
  }
  function findNode(id) {
    let found = null;
    walk(state.board, (n) => { if (n.id === id) found = n; });
    return found;
  }
  function findParent(id) {
    let result = null;
    walk(state.board, (n) => {
      if (n.children && n.children.some((c) => c.id === id)) result = n;
    });
    return result;
  }
  function isRootChild(id) {
    return (state.board.children || []).some((c) => c.id === id);
  }
  function allNotes() {
    const list = [];
    walk(state.board, (n) => { if (n.type === "note") list.push(n); });
    return list;
  }
  function countNotes() {
    let n = 0; walk(state.board, (x) => { if (x.type === "note") n++; }); return n;
  }

  // ---------------------------------------------------------------------
  // History / undo
  // ---------------------------------------------------------------------
  function pushHistory() {
    history.push(JSON.stringify(state.board));
    if (history.length > HISTORY_MAX) history.shift();
    // A new mutation invalidates the redo branch.
    redoStack = [];
  }
  function undo() {
    // If a field is being edited, commit it first, then undo on next tick.
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
      active.blur();
      setTimeout(undo, 0);
      return;
    }
    if (!history.length) { toast("Nothing to undo"); return; }
    redoStack.push(JSON.stringify(state.board));
    state.board = JSON.parse(history.pop());
    save(); render();
    toast("Undid");
  }
  function redo() {
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
      active.blur();
      setTimeout(redo, 0);
      return;
    }
    if (!redoStack.length) { toast("Nothing to redo"); return; }
    history.push(JSON.stringify(state.board));
    state.board = JSON.parse(redoStack.pop());
    save(); render();
    toast("Redid");
  }

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.board)); } catch (e) { /* ignore quota */ }
  }
  function load() {
    try {
      // Also check the previous storage key so existing boards migrate.
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("flexity-demo-v5");
      if (!raw) return null;
      const board = JSON.parse(raw);
      migrateNotes(board);
      return { board };
    } catch (e) { return null; }
  }

  // Migrate old notes that have a title field: merge title into body.
  function migrateNotes(node) {
    if (node.type === "note" && node.title != null) {
      const body = node.body || "";
      if (body) node.body = `**${node.title}**\n\n${body}`;
      else node.body = `**${node.title}**`;
      delete node.title;
    }
    (node.children || []).forEach(migrateNotes);
  }

  // Derive a short display name from a note's body (first non-empty line,
  // with markdown formatting stripped) — used by the reference picker and
  // breadcrumbs now that notes no longer have a title field.
  function noteName(note) {
    const body = (note.body || "").trim();
    if (!body) return "Untitled";
    const firstLine = body.split("\n")[0].trim();
    return firstLine.replace(/[*_`#\[\]]/g, "").slice(0, 60) || "Untitled";
  }

  // ---------------------------------------------------------------------
  // Seed data — trays are the main characters: most root items are trays,
  // one column anchors today's work. Demonstrates nesting, a shadow, a
  // reference, highlight, and markdown.
  // ---------------------------------------------------------------------
  function seed() {
    const board = {
      type: "board",
      title: "Launch Flexity",
      children: [
        // The only column — a pinned "Today" slot.
        { type: "column", title: "Today", folded: false, children: [
          { type: "note", body: "**Write landing copy**\n\nHero, features, CTA.\n\nSee [[@Ship demo]] for scope.", highlighted: true, shadowOf: null, children: [] },
          { type: "note", body: "**Ship demo**\n\nWire the board engine.", highlighted: false, shadowOf: null, children: [
            { type: "note", body: "**Drag & drop**\n\nReorder + move between trays.", highlighted: false, shadowOf: null, children: [] },
            { type: "note", body: "**Undo stack**\n\nCtrl+Z everywhere.", highlighted: false, shadowOf: null, children: [] }
          ]}
        ]},
        // Root trays — the flexible majority.
        { type: "tray", title: "Next", folded: false, highlighted: false, shadowOf: null, children: [
          { type: "note", body: "**Draft Q3 roadmap**\n\nThree themes:\n\n1. Performance\n2. Onboarding\n3. Mobile\n\nSee [planning doc](https://example.com).", highlighted: false, shadowOf: null, children: [
            { type: "note", body: "**Scope each theme**\n\n1-page brief per theme.", highlighted: false, shadowOf: null, children: [] }
          ]},
          { type: "note", body: "**Migrate docs**\n\nMove the old wiki into the new vault.", highlighted: false, shadowOf: null, children: [] }
        ]},
        { type: "tray", title: "Polish", folded: false, highlighted: false, shadowOf: null, children: [
          { type: "note", body: "**Shadows**\n\nPointer refs across trays.\nHover a host & its shadow to see the pair.", highlighted: false, shadowOf: null, children: [] },
          { type: "note", body: "**Markdown notes**\n\nRender **bold**, *italic*, `code`, and [links](https://example.com).", highlighted: false, shadowOf: null, children: [] }
        ]},
        { type: "tray", title: "Waiting", folded: false, highlighted: false, shadowOf: null, children: [
          { type: "note", body: "**Vendor contract**\n\nOn legal since *Monday*.", highlighted: false, shadowOf: null, children: [] }
        ]},
        { type: "tray", title: "Someday", folded: false, highlighted: false, shadowOf: null, children: [
          { type: "note", body: "**Learn Rust**", highlighted: false, shadowOf: null, children: [] },
          { type: "note", body: "**Write a CLI tool**", highlighted: false, shadowOf: null, children: [] }
        ]},
        { type: "tray", title: "Done", folded: false, highlighted: false, shadowOf: null, children: [
          { type: "note", body: "**JSON model**\n\nDefined board / column / tray / note.", highlighted: false, shadowOf: null, children: [] }
        ]}
      ]
    };
    assignIds(board);
    // Seed a shadow of "Ship demo" into the Done tray to demonstrate the feature.
    const today = board.children[0];
    const shipDemo = today.children[1];
    const done = board.children[5];
    done.children.push({
      id: uid("note"), type: "note", body: shipDemo.body,
      highlighted: false, shadowOf: shipDemo.id, children: []
    });
    return { board };
  }

  // ---------------------------------------------------------------------
  // Markdown (tiny, safe: escape first, then apply inline + list rules)
  // ---------------------------------------------------------------------
  function md(text) {
    if (!text) return "";
    let s = esc(text);
    // Inline references [[@Title]]
    s = s.replace(/\[\[@([^\]]+)\]\]/g, '<span class="ref-link" data-ref="$1">@$1</span>');
    // Links [text](url) — url must be http(s) or relative
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // Inline code
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold then italic (order matters)
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    // Split into lines; group consecutive "- " / "* " into <ul>, "#"+ into headings
    const lines = s.split("\n");
    let html = "", inList = false;
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s+(.*)$/);
      if (m) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${m[1]}</li>`;
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) {
          const lvl = h[1].length;
          html += `<h${lvl}>${h[2]}</h${lvl}>`;
        } else if (line.trim() === "") {
          html += "";
        } else {
          html += `<p>${line}</p>`;
        }
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  function render() {
    boardTitleEl.textContent = state.board.title || "Untitled board";
    boardEl.innerHTML = "";

    const root = state.board.children || [];
    const columns = root.filter((c) => c.type === "column");
    const trays = root.filter((c) => c.type === "tray");

    // Masonry: columns take full vertical slots; root trays stack vertically
    // in groups. Minimum horizontal slots = columns + (1 if any trays),
    // enforced via min-width + horizontal scroll.
    const SLOT_W = 300, GAP = 16;
    const minSlots = columns.length + (trays.length > 0 ? 1 : 0);
    const scrollEl = boardEl.parentElement; // .board-scroll
    const containerW = scrollEl ? scrollEl.clientWidth - 48 : 800; // minus sp-5 padding * 2
    const slots = Math.max(Math.floor((containerW + GAP) / (SLOT_W + GAP)), minSlots);

    let groupCount = 0;
    if (trays.length > 0) {
      groupCount = Math.min(Math.max(slots - columns.length, 1), trays.length);
    }
    const groups = Array.from({ length: groupCount }, () => []);
    trays.forEach((t, i) => groups[i % groupCount].push(t));

    const boardMinWidth = slots * SLOT_W + (slots - 1) * GAP;
    boardEl.style.minWidth = boardMinWidth + "px";

    // Render columns (full vertical slots)
    columns.forEach((col) => boardEl.appendChild(renderColumn(col)));

    // Render tray stacks (masonry groups)
    const stackEls = [];
    groups.forEach((group) => {
      const stack = document.createElement("div");
      stack.className = "tray-stack";
      group.forEach((t) => stack.appendChild(renderTray(t, true)));
      boardEl.appendChild(stack);
      stackEls.push(stack);
    });

    // Add-tray affordance — appended to the last tray stack so it follows
    // the masonry layout. If no trays exist, create a stack for it.
    const add = document.createElement("a");
    add.href = "#";
    add.className = "add-tray";
    add.innerHTML = "+ Add tray";
    add.addEventListener("click", (e) => { e.preventDefault(); addTray(); });
    if (stackEls.length > 0) {
      stackEls[stackEls.length - 1].appendChild(add);
    } else {
      const stack = document.createElement("div");
      stack.className = "tray-stack";
      stack.appendChild(add);
      boardEl.appendChild(stack);
    }

    syncShadowBodies();
    updateJSON();
  }

  function syncShadowBodies() {
    // Keep shadow note bodies in sync with their host.
    allNotes().forEach((c) => {
      if (c.shadowOf) {
        const host = findNode(c.shadowOf);
        if (host) c.body = host.body;
      }
    });
  }

  // --- Column ---
  function renderColumn(col) {
    const el = document.createElement("section");
    el.className = "column" + (col.folded ? " is-folded" : "");
    el.dataset.id = col.id;
    el.setAttribute("aria-label", col.title);

    // Head
    const head = document.createElement("div");
    head.className = "column__head";
    head.appendChild(iconButton("column__fold", col.folded ? "▸" : "▾", "Fold column", () => { pushHistory(); col.folded = !col.folded; save(); render(); }));

    const title = document.createElement("div");
    title.className = "column__title";
    title.textContent = col.title;
    title.contentEditable = "true";
    title.spellcheck = false;
    title.draggable = false;
    title.addEventListener("dragover", (e) => { if (dragId) e.preventDefault(); });
    title.addEventListener("drop", (e) => { if (dragId) e.preventDefault(); });
    title.addEventListener("focus", () => pushHistory());
    title.addEventListener("blur", () => {
      const v = title.textContent.trim();
      if (v && v !== col.title) { col.title = v; save(); syncShadowBodies(); render(); }
      else render();
    });
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
      if (e.key === "Escape") { title.textContent = col.title; title.blur(); }
    });
    head.appendChild(title);

    const menu = document.createElement("div");
    menu.className = "column__menu";
    // Switch root column → tray
    if (isRootChild(col.id)) {
      menu.appendChild(iconButton("", "⇄", "Switch to tray", () => switchRootType(col.id)));
    }
    menu.appendChild(iconButton("", "✕", "Delete column", () => deleteNode(col.id)));
    head.appendChild(menu);
    el.appendChild(head);

    // Ctrl+click on head adds a note
    head.addEventListener("click", (e) => {
      if (e.target.closest(".column__menu") || e.target.closest(".column__title") || e.target.closest(".column__fold")) return;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); addNote(col); }
    });

    // Body — drop target for reordering/moving notes
    const body = document.createElement("div");
    body.className = "column__body";
    body.dataset.empty = (col.children || []).length ? "false" : "true";
    attachColumnDrop(body, col);
    (col.children || []).forEach((child) => {
      if (child.type === "tray") body.appendChild(renderTray(child, false));
      else body.appendChild(renderNote(child, false));
    });
    el.appendChild(body);

    // Foot — add note
    const foot = document.createElement("div");
    foot.className = "column__foot";
    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg> Add note';
    addBtn.addEventListener("click", () => addNote(col));
    foot.appendChild(addBtn);
    el.appendChild(foot);

    return el;
  }

  // --- Tray (container that nests children INSIDE, like a column but
  // recursively composable; heading-only, no body content) ---
  function renderTray(tray, isRoot) {
    const el = document.createElement("section");
    el.className = "tray" + (isRoot ? " tray--root" : "") + (tray.folded ? " is-folded" : "");
    el.dataset.id = tray.id;
    el.draggable = true;
    if (tray.highlighted) el.classList.add("is-highlighted");
    if (tray.shadowOf) el.classList.add("is-shadow");
    el.setAttribute("aria-label", tray.title);

    attachShadowHover(el, tray);
    attachNoteDrag(el, tray);

    // Head
    const head = document.createElement("div");
    head.className = "tray__head";
    head.appendChild(iconButton("tray__fold", tray.folded ? "▸" : "▾", "Fold tray", () => { pushHistory(); tray.folded = !tray.folded; save(); render(); }));

    const title = document.createElement("div");
    title.className = "tray__title";
    title.textContent = tray.title;
    title.draggable = false;
    if (!tray.shadowOf) {
      title.contentEditable = "true";
      title.spellcheck = false;
      title.addEventListener("dragover", (e) => { if (dragId) e.preventDefault(); });
      title.addEventListener("drop", (e) => { if (dragId) e.preventDefault(); });
      title.addEventListener("focus", () => pushHistory());
      title.addEventListener("blur", () => {
        const v = title.textContent.trim();
        if (v && v !== tray.title) { tray.title = v; save(); syncShadowBodies(); render(); }
        else render();
      });
      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); title.blur(); }
        if (e.key === "Escape") { title.textContent = tray.title; title.blur(); }
      });
    }
    head.appendChild(title);

    const menu = document.createElement("div");
    menu.className = "tray__menu";
    if (!tray.shadowOf) {
      menu.appendChild(iconButton("", "🔗", "Add reference", () => addReference(tray)));
      if (isRoot) menu.appendChild(iconButton("", "⇄", "Switch to column", () => switchRootType(tray.id)));
    }
    menu.appendChild(iconButton("", "✕", "Delete tray", () => deleteNode(tray.id)));
    head.appendChild(menu);
    el.appendChild(head);

    // Ctrl+click on head adds a note
    head.addEventListener("click", (e) => {
      if (e.target.closest(".tray__menu") || e.target.closest(".tray__title") || e.target.closest(".tray__fold")) return;
      if (tray.shadowOf) return;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); addNote(tray); }
    });

    // Children — nested INSIDE the tray (like a column), no body content.
    const body = document.createElement("div");
    body.className = "tray__body";
    body.dataset.empty = (tray.children || []).length ? "false" : "true";
    attachColumnDrop(body, tray);
    (tray.children || []).forEach((child) => {
      if (child.type === "tray") body.appendChild(renderTray(child, false));
      else body.appendChild(renderNote(child, false));
    });
    el.appendChild(body);

    // Foot — add note
    const foot = document.createElement("div");
    foot.className = "tray__foot";
    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg> Add note';
    addBtn.addEventListener("click", () => addNote(tray));
    foot.appendChild(addBtn);
    el.appendChild(foot);

    return el;
  }

  // --- Note ---
  // A note is just a markdown snippet — no title, just body. The body IS
  // the note. Returns a .note-group wrapper containing the note article
  // and its sub-notes as siblings (stacked below, not nested inside the
  // article). This keeps draggable elements non-nested so dragging a
  // child never drags its parent.
  function renderNote(note, isRoot) {
    const group = document.createElement("div");
    group.className = "note-group";
    group.dataset.id = note.id;

    const el = document.createElement("article");
    el.className = "note";
    el.dataset.id = note.id;
    el.draggable = true;
    if (note.highlighted) el.classList.add("is-highlighted");
    if (note.shadowOf) el.classList.add("is-shadow");
    el.setAttribute("aria-label", noteName(note));

    attachShadowHover(el, note);
    attachNoteDrag(el, note);
    attachNoteDrop(el, note); // nesting drop target

    // Body — the note IS its markdown body. Click to edit (non-shadows).
    const body = document.createElement("div");
    body.className = "note__body";
    body.dataset.id = note.id;
    body.draggable = false;
    if (note.body) body.innerHTML = md(note.body);
    else { body.classList.add("is-empty"); body.dataset.placeholder = "Add markdown…"; }
    if (!note.shadowOf) {
      body.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        startBodyEdit(note, body);
      });
    }
    el.appendChild(body);

    // Menu — hover toolbar, absolutely positioned top-right
    const menu = document.createElement("div");
    menu.className = "note__menu";
    if (!note.shadowOf) {
      menu.appendChild(iconButton("", "🔗", "Add reference", () => addReference(note)));
      if (isRoot) menu.appendChild(iconButton("", "⇄", "Switch to column", () => switchRootType(note.id)));
    }
    menu.appendChild(iconButton("", "✕", "Delete note", () => deleteNode(note.id)));
    el.appendChild(menu);

    group.appendChild(el);

    // Sub-notes: siblings of the note article (stacked below with
    // indentation), NOT nested inside it.
    const kids = note.children || [];
    if (kids.length) {
      const subs = document.createElement("div");
      subs.className = "note-subs";
      kids.forEach((k) => {
        if (k.type === "tray") subs.appendChild(renderTray(k, false));
        else subs.appendChild(renderNote(k, false));
      });
      group.appendChild(subs);
    }

    // Ctrl+click adds sub-note · Alt+click toggles highlight
    el.addEventListener("click", (e) => {
      if (e.target.closest(".note__menu")) return;
      if (note.shadowOf) return;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); addSubNote(note); }
      else if (e.altKey) { e.preventDefault(); toggleHighlight(note); }
    });

    return group;
  }

  // Inline body editing: swap rendered md for a textarea holding raw source.
  function startBodyEdit(note, bodyEl) {
    if (note.shadowOf) return;
    pushHistory();
    const ta = document.createElement("textarea");
    ta.className = "note__body";
    ta.value = note.body || "";
    ta.addEventListener("dragover", (e) => { if (dragId) e.preventDefault(); });
    ta.addEventListener("drop", (e) => { if (dragId) e.preventDefault(); });
    ta.rows = Math.max(2, (note.body || "").split("\n").length + 1);
    ta.placeholder = "Add markdown…";
    ta.style.resize = "vertical";
    ta.style.minHeight = "60px";
    ta.style.width = "100%";
    ta.style.fontFamily = "var(--font-mono)";
    ta.style.fontSize = "0.8125rem";
    bodyEl.replaceWith(ta);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    const commit = () => {
      note.body = ta.value;
      save(); render();
    };
    ta.addEventListener("blur", commit, { once: true });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { ta.value = note.body || ""; ta.blur(); }
      // Ctrl+Enter commits; Enter inserts newline by default.
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ta.blur(); }
    });
  }

  // ---------------------------------------------------------------------
  // Icon button helper
  // ---------------------------------------------------------------------
  function iconButton(cls, glyph, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn--icon" + (cls ? " " + cls : "");
    b.title = label;
    b.setAttribute("aria-label", label);
    b.textContent = glyph;
    b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  // ---------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------
  function addTray() {
    pushHistory();
    state.board.children = state.board.children || [];
    const tray = { id: uid("tray"), type: "tray", title: "New tray", folded: false, highlighted: false, shadowOf: null, children: [] };
    state.board.children.push(tray);
    save(); render();
    const el = boardEl.querySelector(`.tray[data-id="${tray.id}"] .tray__title`);
    if (el) { el.focus(); selectAll(el); }
  }

  function addNote(col) {
    pushHistory();
    col.children = col.children || [];
    const note = { id: uid("note"), type: "note", body: "", highlighted: false, shadowOf: null, children: [] };
    col.children.push(note);
    if (col.folded) col.folded = false;
    save(); render();
    autoEditNote(note);
  }

  function addSubNote(parent) {
    pushHistory();
    parent.children = parent.children || [];
    const note = { id: uid("note"), type: "note", body: "", highlighted: false, shadowOf: null, children: [] };
    parent.children.push(note);
    save(); render();
    autoEditNote(note);
  }

  // Auto-start body editing for a freshly created note.
  function autoEditNote(note) {
    const bodyEl = boardEl.querySelector(`.note[data-id="${note.id}"] > .note__body`);
    if (bodyEl) startBodyEdit(note, bodyEl);
  }

  function toggleHighlight(note) {
    pushHistory();
    note.highlighted = !note.highlighted;
    save(); render();
  }

  // Reset to the seed board so the user can start fresh after exploring.
  function resetBoard() {
    pushHistory();
    state.board = seed().board;
    save(); render();
    toast("Board reset");
  }

  function deleteNode(id) {
    const parent = findParent(id);
    if (!parent || !parent.children) return;
    const node = parent.children.find((c) => c.id === id);
    if (!node) return;
    // Also remove shadows that point at a deleted note.
    const isNote = node.type === "note";
    pushHistory();
    parent.children = parent.children.filter((c) => c.id !== id);
    if (isNote) {
      // Remove dangling shadows
      walk(state.board, (n) => {
        if (n.children) n.children = n.children.filter((c) => !(c.type === "note" && c.shadowOf === id));
      });
    }
    save(); render();
    toast("Deleted");
  }

  // Switch a root-level item between column and tray.
  function switchRootType(id) {
    if (!isRootChild(id)) { toast("Only root items can switch"); return; }
    const node = findNode(id);
    if (!node) return;
    pushHistory();
    if (node.type === "column") {
      node.type = "tray";
      if (node.folded === undefined) node.folded = false;
    } else if (node.type === "tray") {
      node.type = "column";
      node.folded = false;
    }
    save(); render();
    toast(node.type === "column" ? "Promoted to column" : "Demoted to tray");
  }

  // Cast a shadow (read-only pointer) of a note into a target container.
  function castShadowInto(host, target) {
    pushHistory();
    target.children = target.children || [];
    target.children.push({
      id: uid("note"), type: "note", body: host.body || "",
      highlighted: false, shadowOf: host.id, children: []
    });
    save(); render();
    toast(`Shadow of "${noteName(host)}" cast`);
  }

  // Add an inline reference link [[@Target]] to a note's body.
  function addReference(note) {
    const notes = allNotes().filter((c) => c.id !== note.id && !c.shadowOf);
    if (!notes.length) { toast("No other notes to reference"); return; }
    openModal("Reference a note", notes.map((c) => ({
      label: noteName(c),
      sub: pathOf(c),
      choose: () => {
        pushHistory();
        const ref = `[[@${noteName(c)}]]`;
        note.body = (note.body ? note.body + "\n" : "") + ref;
        save(); render();
        toast(`Referenced "${noteName(c)}"`);
      }
    })));
  }

  // Compute a breadcrumb path for a note (for the picker).
  function pathOf(note) {
    const path = [];
    let cur = note;
    while (cur) {
      path.unshift(cur.type === "note" ? noteName(cur) : cur.title);
      const parent = findParent(cur.id);
      cur = parent && parent !== state.board ? parent : null;
    }
    return path.join(" / ");
  }

  // ---------------------------------------------------------------------
  // Shadow hover: highlight host + all its shadows as a group.
  // ---------------------------------------------------------------------
  function attachShadowHover(el, note) {
    const groupId = note.shadowOf || note.id;
    el.addEventListener("mouseenter", () => highlightGroup(groupId, true));
    el.addEventListener("mouseleave", () => highlightGroup(groupId, false));
  }
  function highlightGroup(groupId, on) {
    boardEl.querySelectorAll(".note").forEach((noteEl) => {
      const id = noteEl.dataset.id;
      const node = findNode(id);
      if (!node) return;
      const g = node.shadowOf || node.id;
      if (g === groupId) noteEl.classList.toggle("is-shadow-pair", on);
    });
  }

  // ---------------------------------------------------------------------
  // Reference link clicks (delegated)
  // ---------------------------------------------------------------------
  boardEl.addEventListener("click", (e) => {
    const ref = e.target.closest(".ref-link");
    if (!ref) return;
    const name = ref.dataset.ref;
    const target = allNotes().find((c) => noteName(c) === name);
    if (!target) { toast(`"${name}" not found`); return; }
    const targetEl = boardEl.querySelector(`.note[data-id="${target.id}"]`);
    if (!targetEl) return;
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    targetEl.classList.add("is-shadow-pair");
    setTimeout(() => targetEl.classList.remove("is-shadow-pair"), 1400);
  });

  // ---------------------------------------------------------------------
  // Drag & drop (HTML5). Notes reorder within/between columns; dropping
  // onto a note nests it as a sub-note.
  // ---------------------------------------------------------------------
  let dragId = null;
  let isShadowCast = false;
  let dropIndicator = null;

  // Capture-phase guard: prevent any drop into editable fields (titles,
  // textareas, inputs) while an internal note drag is in progress. Using
  // the capture phase ensures this runs before any element-level handler,
  // closing the race where a quick drop fires before the title's own
  // dragover/drop listener can react.
  function isEditableTarget(t) {
    return t && (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "INPUT");
  }
  document.addEventListener("dragover", (e) => {
    if (!dragId) return;
    if (isEditableTarget(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("drop", (e) => {
    if (!dragId) return;
    if (isEditableTarget(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  function attachNoteDrag(el, note) {
    if (note.shadowOf) { el.draggable = false; return; }
    el.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      dragId = note.id;
      isShadowCast = e.ctrlKey || e.metaKey; // Ctrl+drag casts a shadow instead of moving
      el.classList.add("is-dragging");
      if (isShadowCast) {
        e.dataTransfer.effectAllowed = "copy";
        el.classList.add("is-shadow-cast");
      } else {
        e.dataTransfer.effectAllowed = "move";
      }
      try { e.dataTransfer.setData("text/plain", note.id); } catch (_) {}
    });
    el.addEventListener("dragend", () => {
      dragId = null;
      isShadowCast = false;
      el.classList.remove("is-dragging", "is-shadow-cast");
      clearIndicator();
      boardEl.querySelectorAll(".is-over").forEach((n) => n.classList.remove("is-over"));
    });
  }

  function attachColumnDrop(bodyEl, col) {
    bodyEl.addEventListener("dragover", (e) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = isShadowCast ? "copy" : "move";
      bodyEl.parentElement.classList.add("is-over");
      if (!isShadowCast) {
        // Clear note-level nesting highlights — only the reorder indicator
        // should be visible when hovering in the gap between items.
        boardEl.querySelectorAll(".note.is-over").forEach((n) => n.classList.remove("is-over"));
        const index = computeIndex(bodyEl, e.clientY);
        showIndicator(bodyEl, index);
      }
    });
    bodyEl.addEventListener("dragleave", (e) => {
      if (!bodyEl.contains(e.relatedTarget)) {
        bodyEl.parentElement.classList.remove("is-over");
        clearIndicator();
      }
    });
    bodyEl.addEventListener("drop", (e) => {
      if (!dragId) return;
      e.preventDefault();
      e.stopPropagation();
      if (isShadowCast) {
        const host = findNode(dragId);
        if (host) castShadowInto(host, col);
        isShadowCast = false;
      } else {
        const index = computeIndex(bodyEl, e.clientY);
        moveNote(dragId, col, index);
      }
      bodyEl.parentElement.classList.remove("is-over");
      clearIndicator();
    });
  }

  function attachNoteDrop(el, note) {
    el.addEventListener("dragover", (e) => {
      if (!dragId || dragId === note.id) return;
      // Prevent dropping onto a descendant OR an ancestor (avoids cycles).
      if (!isShadowCast && (isDescendant(note.id, dragId) || isDescendant(dragId, note.id))) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = isShadowCast ? "copy" : "move";
      el.classList.add("is-over");
      // Hide the reorder indicator — only the nesting highlight should show.
      clearIndicator();
    });
    el.addEventListener("dragleave", () => el.classList.remove("is-over"));
    el.addEventListener("drop", (e) => {
      if (!dragId || dragId === note.id) return;
      if (!isShadowCast && (isDescendant(note.id, dragId) || isDescendant(dragId, note.id))) return;
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove("is-over");
      if (isShadowCast) {
        const host = findNode(dragId);
        if (host) castShadowInto(host, note);
        isShadowCast = false;
      } else {
        moveNote(dragId, note, null, true); // nest as sub-note
      }
    });
  }

  function isDescendant(ancestorId, maybeDescId) {
    const anc = findNode(ancestorId);
    if (!anc) return false;
    let res = false;
    walk(anc, (n) => { if (n.id === maybeDescId && n !== anc) res = true; });
    return res;
  }

  function computeIndex(bodyEl, clientY) {
    const items = Array.from(bodyEl.querySelectorAll(":scope > *"));
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return items.length;
  }

  function showIndicator(bodyEl, index) {
    clearIndicator();
    const items = Array.from(bodyEl.querySelectorAll(":scope > *"));
    const ind = document.createElement("div");
    ind.className = "drop-indicator";
    const HALF_GAP = 4; // half of var(--sp-2)
    let top;
    // Use offsetTop/offsetHeight (layout-relative to the padding edge of
    // bodyEl) so the value matches position: absolute; top: which is also
    // relative to the padding edge. getBoundingClientRect() is viewport-
    // relative and breaks when the body is scrolled.
    if (items.length === 0 || index >= items.length) {
      const last = items[items.length - 1];
      top = last ? last.offsetTop + last.offsetHeight + HALF_GAP : HALF_GAP;
    } else {
      const target = items[index];
      const prev = items[index - 1];
      if (prev) {
        // Center in the gap between previous and target
        top = (prev.offsetTop + prev.offsetHeight + target.offsetTop) / 2;
      } else {
        // First item — place in the top padding
        top = Math.max(target.offsetTop - HALF_GAP, HALF_GAP);
      }
    }
    ind.style.top = top + "px";
    bodyEl.appendChild(ind);
    dropIndicator = ind;
  }
  function clearIndicator() {
    if (dropIndicator && dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
    dropIndicator = null;
  }

  // Move a note to a new parent (column, tray, or note) at an index. If
  // nest=true, append to the target note's children.
  function moveNote(id, target, index, nest = false) {
    const parent = findParent(id);
    if (!parent || !parent.children) return;
    const node = parent.children.find((c) => c.id === id);
    if (!node) return;
    if (nest && target.id === id) return;
    // If moving within the same parent and not nesting, adjust index.
    pushHistory();
    parent.children = parent.children.filter((c) => c.id !== id);
    if (nest) {
      target.children = target.children || [];
      target.children.push(node);
    } else {
      target.children = target.children || [];
      let i = index == null ? target.children.length : index;
      if (parent === target) i = Math.max(0, i - 1);
      target.children.splice(i, 0, node);
    }
    save(); render();
  }

  // ---------------------------------------------------------------------
  // Modal (column/reference picker)
  // ---------------------------------------------------------------------
  function openModal(title, items) {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `<div class="modal__head"><span class="modal__title">${esc(title)}</span></div>`;
    const body = document.createElement("div");
    body.className = "modal__body";
    items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "modal__item";
      b.innerHTML = `<span>${esc(it.label)}</span>${it.sub ? `<span class="path">${esc(it.sub)}</span>` : ""}`;
      b.addEventListener("click", () => { closeModal(back); it.choose(); });
      body.appendChild(b);
    });
    modal.appendChild(body);
    back.appendChild(modal);
    back.addEventListener("click", (e) => { if (e.target === back) closeModal(back); });
    document.body.appendChild(back);
    // Close on Escape
    const onKey = (e) => { if (e.key === "Escape") { closeModal(back); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
  }
  function closeModal(back) { if (back.parentNode) back.parentNode.removeChild(back); }

  // ---------------------------------------------------------------------
  // JSON drawer
  // ---------------------------------------------------------------------
  function updateJSON() {
    if (!jsonDrawer.hasAttribute("hidden")) {
      const json = JSON.stringify(state.board, null, 2);
      jsonOut.innerHTML = tintJSON(json);
    }
  }
  function tintJSON(json) {
    return esc(json)
      .replace(/&quot;([^&]*?)&quot;:/g, '<span class="k">"$1"</span>:')
      .replace(/: &quot;([^&]*?)&quot;/g, ': <span class="s">"$1"</span>')
      .replace(/: (true|false|null)/g, ': <span class="b">$1</span>');
  }

  // ---------------------------------------------------------------------
  // Toolbar wiring
  // ---------------------------------------------------------------------
  document.getElementById("btn-add-tray").addEventListener("click", addTray);
  document.getElementById("btn-reset").addEventListener("click", resetBoard);
  document.getElementById("kbd-undo").addEventListener("click", undo);
  document.getElementById("kbd-redo").addEventListener("click", redo);
  const btnJson = document.getElementById("btn-json");
  btnJson.addEventListener("click", () => {
    const open = jsonDrawer.hasAttribute("hidden");
    jsonDrawer.toggleAttribute("hidden", !open);
    btnJson.setAttribute("aria-pressed", open ? "true" : "false");
    if (open) updateJSON();
  });

  // Global shortcuts: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo.
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
  });

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    toastWrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 200ms"; }, 1600);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 1900);
  }

  // ---------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------
  function selectAll(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  render();
  // Re-render on resize so masonry groups recalculate.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(), 100);
  });
})();
