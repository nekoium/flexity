/* =========================================================================
   Flexity demo — the board engine.
   JSON-native model, rendered live. Every mutation flows through history.
   Features: stackable (nested) cards, fold, markdown notes, highlight,
   shadows (pointer refs with pair-hover), card references (inline + picker),
   switch root card ⇄ column, undo, drag-and-drop, live JSON.
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
  const STORAGE_KEY = "flexity-demo-v1";
  let state = load() || seed();
  let history = [];
  let redoStack = [];
  const HISTORY_MAX = 60;

  // DOM refs
  const boardEl = document.getElementById("board");
  const boardTitleEl = document.getElementById("board-title");
  const boardCountEl = document.getElementById("board-count");
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
  function allCards() {
    const list = [];
    walk(state.board, (n) => { if (n.type === "card") list.push(n); });
    return list;
  }
  function countCards() {
    let n = 0; walk(state.board, (x) => { if (x.type === "card") n++; }); return n;
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const board = JSON.parse(raw);
      return { board };
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------------
  // Seed data — demonstrates nesting, a shadow, a reference, highlight
  // ---------------------------------------------------------------------
  function seed() {
    const board = {
      type: "board",
      title: "Launch Flexity",
      children: [
        { type: "column", title: "Today", folded: false, children: [
          { type: "card", title: "Write landing copy", body: "Hero, features, CTA.\n\nSee [[@Ship demo]] for scope.", highlighted: true, shadowOf: null, children: [] },
          { type: "card", title: "Ship demo", body: "Wire the board engine.", highlighted: false, shadowOf: null, children: [
            { type: "card", title: "Drag & drop", body: "Reorder + move between columns.", highlighted: false, shadowOf: null, children: [] },
            { type: "card", title: "Undo stack", body: "Ctrl+Z everywhere.", highlighted: false, shadowOf: null, children: [] }
          ]}
        ]},
        { type: "column", title: "Backlog", folded: false, children: [
          { type: "card", title: "Shadows", body: "Pointer refs across columns.\nHover a host & its shadow to see the pair.", highlighted: false, shadowOf: null, children: [] },
          { type: "card", title: "Markdown notes", body: "Render **bold**, *italic*, `code`, and [links](https://example.com).", highlighted: false, shadowOf: null, children: [] }
        ]},
        { type: "column", title: "Done", folded: false, children: [
          { type: "card", title: "JSON model", body: "Defined board / column / card.", highlighted: false, shadowOf: null, children: [] }
        ]}
      ]
    };
    assignIds(board);
    // Seed a shadow of "Ship demo" into the Done column to demonstrate the feature.
    const today = board.children[0];
    const shipDemo = today.children[1];
    const done = board.children[2];
    done.children.push({
      id: uid("card"), type: "card", title: shipDemo.title, body: "",
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
    // Split into lines; group consecutive "- " / "* " into <ul>
    const lines = s.split("\n");
    let html = "", inList = false;
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s+(.*)$/);
      if (m) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${m[1]}</li>`;
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        if (line.trim() === "") html += "";
        else html += `<p>${line}</p>`;
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
    boardCountEl.textContent = `${countCards()} card${countCards() === 1 ? "" : "s"}`;
    boardEl.innerHTML = "";
    (state.board.children || []).forEach((child) => {
      if (child.type === "column") boardEl.appendChild(renderColumn(child));
      else if (child.type === "card") boardEl.appendChild(renderRootCard(child));
    });
    // Add-column affordance
    const add = document.createElement("a");
    add.href = "#";
    add.className = "add-column";
    add.innerHTML = "+ Add column";
    add.addEventListener("click", (e) => { e.preventDefault(); addColumn(); });
    boardEl.appendChild(add);
    syncShadowTitles();
    updateJSON();
  }

  function syncShadowTitles() {
    // Keep shadow card titles in sync with their host.
    allCards().forEach((c) => {
      if (c.shadowOf) {
        const host = findNode(c.shadowOf);
        if (host) c.title = host.title;
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
    title.addEventListener("focus", () => pushHistory());
    title.addEventListener("blur", () => {
      const v = title.textContent.trim();
      if (v && v !== col.title) { col.title = v; save(); syncShadowTitles(); render(); }
      else render();
    });
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
      if (e.key === "Escape") { title.textContent = col.title; title.blur(); }
    });
    head.appendChild(title);

    const count = document.createElement("span");
    count.className = "column__count";
    count.textContent = (col.children || []).length;
    head.appendChild(count);

    const menu = document.createElement("div");
    menu.className = "column__menu";
    // Switch root column → card
    if (isRootChild(col.id)) {
      menu.appendChild(iconButton("", "⇄", "Switch to card", () => switchRootType(col.id)));
    }
    menu.appendChild(iconButton("", "✕", "Delete column", () => deleteNode(col.id)));
    head.appendChild(menu);
    el.appendChild(head);

    // Body — drop target for reordering/moving cards
    const body = document.createElement("div");
    body.className = "column__body";
    body.dataset.empty = (col.children || []).length ? "false" : "true";
    attachColumnDrop(body, col);
    (col.children || []).forEach((card) => body.appendChild(renderCard(card, false)));
    el.appendChild(body);

    // Foot — add card
    const foot = document.createElement("div");
    foot.className = "column__foot";
    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg> Add card';
    addBtn.addEventListener("click", () => addCard(col));
    foot.appendChild(addBtn);
    el.appendChild(foot);

    return el;
  }

  // --- Root card (rendered as a column-like fixed-width block, can switch to column) ---
  function renderRootCard(card) {
    const wrap = document.createElement("div");
    wrap.className = "rootcard";
    wrap.appendChild(renderCard(card, true));
    return wrap;
  }

  // --- Card ---
  function renderCard(card, isRoot) {
    const el = document.createElement("article");
    el.className = "card";
    el.dataset.id = card.id;
    el.draggable = true;
    if (card.highlighted) el.classList.add("is-highlighted");
    if (card.shadowOf) el.classList.add("is-shadow");
    el.setAttribute("aria-label", card.title);

    attachShadowHover(el, card);
    attachCardDrag(el, card);
    attachCardDrop(el, card); // nesting drop target

    // Head
    const head = document.createElement("div");
    head.className = "card__head";

    const title = document.createElement("div");
    title.className = "card__title";
    title.textContent = card.title;
    title.draggable = false;
    if (!card.shadowOf) {
      title.contentEditable = "true";
      title.spellcheck = false;
      title.addEventListener("focus", () => pushHistory());
      title.addEventListener("blur", () => {
        const v = title.textContent.trim();
        if (v && v !== card.title) {
          card.title = v; save(); syncShadowTitles(); render();
        } else render();
      });
      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); title.blur(); }
        if (e.key === "Escape") { title.textContent = card.title; title.blur(); }
      });
    }
    head.appendChild(title);

    // Menu
    const menu = document.createElement("div");
    menu.className = "card__menu";
    if (!card.shadowOf) {
      menu.appendChild(iconButton("", "+", "Add sub-card", () => addSubCard(card)));
      menu.appendChild(iconButton("", "★", "Highlight (Alt+click)", () => toggleHighlight(card)));
      menu.appendChild(iconButton("", "⇲", "Cast shadow", () => castShadow(card)));
      menu.appendChild(iconButton("", "🔗", "Add reference", () => addReference(card)));
      if (isRoot) menu.appendChild(iconButton("", "⇄", "Switch to column", () => switchRootType(card.id)));
    }
    menu.appendChild(iconButton("", "✕", "Delete card", () => deleteNode(card.id)));
    head.appendChild(menu);
    el.appendChild(head);

    // Body (rendered md, click to edit) — skip for shadows
    if (!card.shadowOf) {
      const body = document.createElement("div");
      body.className = "card__body";
      body.dataset.id = card.id;
      body.draggable = false;
      if (card.body) body.innerHTML = md(card.body);
      else { body.classList.add("is-empty"); body.dataset.placeholder = "Add markdown…"; }
      body.addEventListener("click", () => startBodyEdit(card, body));
      el.appendChild(body);
    }

    // Children (nested cards)
    const kids = card.children || [];
    if (kids.length) {
      const childWrap = document.createElement("div");
      childWrap.className = "card__children";
      const label = document.createElement("div");
      label.className = "card__children-label";
      label.textContent = `${kids.length} sub-card${kids.length === 1 ? "" : "s"}`;
      childWrap.appendChild(label);
      kids.forEach((k) => childWrap.appendChild(renderCard(k, false)));
      el.appendChild(childWrap);
    }

    // Alt+click highlight
    el.addEventListener("click", (e) => {
      if (e.altKey && !card.shadowOf && e.target.closest(".card__menu") === null && e.target.closest(".card__title") === null) {
        e.preventDefault();
        toggleHighlight(card);
      }
    });

    return el;
  }

  // Inline body editing: swap rendered md for a textarea holding raw source.
  function startBodyEdit(card, bodyEl) {
    if (card.shadowOf) return;
    pushHistory();
    const ta = document.createElement("textarea");
    ta.className = "card__body";
    ta.value = card.body || "";
    ta.rows = Math.max(2, (card.body || "").split("\n").length + 1);
    ta.dataset.placeholder = "Add markdown…";
    ta.style.resize = "vertical";
    ta.style.minHeight = "60px";
    ta.style.width = "100%";
    ta.style.fontFamily = "var(--font-mono)";
    ta.style.fontSize = "0.8125rem";
    bodyEl.replaceWith(ta);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    const commit = () => {
      card.body = ta.value;
      save(); render();
    };
    ta.addEventListener("blur", commit, { once: true });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { ta.value = card.body || ""; ta.blur(); }
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
  function addColumn() {
    pushHistory();
    state.board.children = state.board.children || [];
    state.board.children.push({
      id: uid("col"), type: "column", title: "New column", folded: false, children: []
    });
    save(); render();
    // Focus the new column title for quick naming.
    const last = boardEl.querySelector(".column:last-of-type .column__title");
    if (last) { last.focus(); selectAll(last); }
  }

  function addCard(col) {
    pushHistory();
    col.children = col.children || [];
    const card = { id: uid("card"), type: "card", title: "New card", body: "", highlighted: false, shadowOf: null, children: [] };
    col.children.push(card);
    if (col.folded) col.folded = false;
    save(); render();
    const el = boardEl.querySelector(`.column[data-id="${col.id}"] .card:last-of-type .card__title`);
    if (el) { el.focus(); selectAll(el); }
  }

  function addSubCard(parent) {
    pushHistory();
    parent.children = parent.children || [];
    parent.children.push({ id: uid("card"), type: "card", title: "New sub-card", body: "", highlighted: false, shadowOf: null, children: [] });
    save(); render();
    const el = boardEl.querySelector(`.card[data-id="${parent.id}"] > .card__children .card:last-of-type .card__title`);
    if (el) { el.focus(); selectAll(el); }
  }

  function toggleHighlight(card) {
    pushHistory();
    card.highlighted = !card.highlighted;
    save(); render();
  }

  function deleteNode(id) {
    const parent = findParent(id);
    if (!parent || !parent.children) return;
    const node = parent.children.find((c) => c.id === id);
    if (!node) return;
    // Also remove shadows that point at a deleted card.
    const isCard = node.type === "card";
    pushHistory();
    parent.children = parent.children.filter((c) => c.id !== id);
    if (isCard) {
      // Remove dangling shadows
      walk(state.board, (n) => {
        if (n.children) n.children = n.children.filter((c) => !(c.type === "card" && c.shadowOf === id));
      });
    }
    save(); render();
    toast("Deleted");
  }

  // Switch a root-level item between column and card.
  function switchRootType(id) {
    if (!isRootChild(id)) { toast("Only root items can switch"); return; }
    const node = findNode(id);
    if (!node) return;
    pushHistory();
    if (node.type === "column") {
      node.type = "card";
      // A card may host sub-cards; existing column children (cards) stay valid.
    } else if (node.type === "card") {
      node.type = "column";
      node.folded = false;
    }
    save(); render();
    toast(node.type === "column" ? "Promoted to column" : "Demoted to card");
  }

  // Cast a shadow (read-only pointer) of a card into a chosen column.
  function castShadow(host) {
    const columns = (state.board.children || []).filter((c) => c.type === "column");
    if (!columns.length) { toast("Add a column first"); return; }
    openModal("Cast shadow into…", columns.map((col) => ({
      label: col.title,
      sub: `${(col.children || []).length} cards`,
      choose: () => {
        pushHistory();
        col.children.push({
          id: uid("card"), type: "card", title: host.title, body: "",
          highlighted: false, shadowOf: host.id, children: []
        });
        save(); render();
        toast(`Shadow of "${host.title}" added to ${col.title}`);
      }
    })));
  }

  // Add an inline reference link [[@Target]] to a card's body.
  function addReference(card) {
    const cards = allCards().filter((c) => c.id !== card.id && !c.shadowOf);
    if (!cards.length) { toast("No other cards to reference"); return; }
    openModal("Reference a card", cards.map((c) => ({
      label: c.title,
      sub: pathOf(c),
      choose: () => {
        pushHistory();
        const ref = `[[@${c.title}]]`;
        card.body = (card.body ? card.body + "\n" : "") + ref;
        save(); render();
        toast(`Referenced "${c.title}"`);
      }
    })));
  }

  // Compute a breadcrumb path for a card (for the picker).
  function pathOf(card) {
    const path = [];
    let cur = card;
    while (cur) {
      path.unshift(cur.title);
      const parent = findParent(cur.id);
      cur = parent && parent !== state.board ? parent : null;
    }
    return path.join(" / ");
  }

  // ---------------------------------------------------------------------
  // Shadow hover: highlight host + all its shadows as a group.
  // ---------------------------------------------------------------------
  function attachShadowHover(el, card) {
    const groupId = card.shadowOf || card.id;
    el.addEventListener("mouseenter", () => highlightGroup(groupId, true));
    el.addEventListener("mouseleave", () => highlightGroup(groupId, false));
  }
  function highlightGroup(groupId, on) {
    boardEl.querySelectorAll(".card").forEach((cardEl) => {
      const id = cardEl.dataset.id;
      const node = findNode(id);
      if (!node) return;
      const g = node.shadowOf || node.id;
      if (g === groupId) cardEl.classList.toggle("is-shadow-pair", on);
    });
  }

  // ---------------------------------------------------------------------
  // Reference link clicks (delegated)
  // ---------------------------------------------------------------------
  boardEl.addEventListener("click", (e) => {
    const ref = e.target.closest(".ref-link");
    if (!ref) return;
    const title = ref.dataset.ref;
    const target = allCards().find((c) => c.title === title);
    if (!target) { toast(`"${title}" not found`); return; }
    const targetEl = boardEl.querySelector(`.card[data-id="${target.id}"]`);
    if (!targetEl) return;
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    targetEl.classList.add("is-shadow-pair");
    setTimeout(() => targetEl.classList.remove("is-shadow-pair"), 1400);
  });

  // ---------------------------------------------------------------------
  // Drag & drop (HTML5). Cards reorder within/between columns; dropping
  // onto a card nests it as a sub-card.
  // ---------------------------------------------------------------------
  let dragId = null;
  let dropIndicator = null;

  function attachCardDrag(el, card) {
    if (card.shadowOf) { el.draggable = false; return; }
    el.addEventListener("dragstart", (e) => {
      dragId = card.id;
      el.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", card.id); } catch (_) {}
    });
    el.addEventListener("dragend", () => {
      dragId = null;
      el.classList.remove("is-dragging");
      clearIndicator();
      boardEl.querySelectorAll(".is-over").forEach((n) => n.classList.remove("is-over"));
    });
  }

  function attachColumnDrop(bodyEl, col) {
    bodyEl.addEventListener("dragover", (e) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      bodyEl.parentElement.classList.add("is-over");
      const index = computeIndex(bodyEl, e.clientY);
      showIndicator(bodyEl, index);
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
      const index = computeIndex(bodyEl, e.clientY);
      moveCard(dragId, col, index);
      bodyEl.parentElement.classList.remove("is-over");
      clearIndicator();
    });
  }

  function attachCardDrop(el, card) {
    el.addEventListener("dragover", (e) => {
      if (!dragId || dragId === card.id) return;
      // Don't allow dropping a parent into its own descendant.
      if (isDescendant(card.id, dragId)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("is-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("is-over"));
    el.addEventListener("drop", (e) => {
      if (!dragId || dragId === card.id) return;
      if (isDescendant(card.id, dragId)) return;
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove("is-over");
      moveCard(dragId, card, null, true); // nest as sub-card
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
    const cards = Array.from(bodyEl.querySelectorAll(":scope > .card"));
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  function showIndicator(bodyEl, index) {
    clearIndicator();
    const cards = Array.from(bodyEl.querySelectorAll(":scope > .card"));
    const ind = document.createElement("div");
    ind.style.height = "2px";
    ind.style.background = "var(--accent)";
    ind.style.borderRadius = "2px";
    ind.style.margin = "0";
    dropIndicator = ind;
    if (cards.length === 0 || index >= cards.length) {
      bodyEl.appendChild(ind);
    } else {
      bodyEl.insertBefore(ind, cards[index]);
    }
  }
  function clearIndicator() {
    if (dropIndicator && dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
    dropIndicator = null;
  }

  // Move a card to a new parent (column or card) at an index. If nest=true,
  // append to the target card's children.
  function moveCard(id, target, index, nest = false) {
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
    // If a root card was nested, it remains a card (fine). If a card was
    // moved to the board root, keep type as card (root card).
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
  document.getElementById("btn-add-column").addEventListener("click", addColumn);
  document.getElementById("btn-undo").addEventListener("click", undo);
  const btnRedo = document.getElementById("btn-redo");
  if (btnRedo) btnRedo.addEventListener("click", redo);
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
})();
