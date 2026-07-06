/* =========================================================================
   Flexity homepage — morphing view widget.
   Two independent axes:
     • Use case   — switches the pre-inputted dataset (tasks / project / ideas / SOP)
     • View as    — re-renders the current dataset (board / tree / outline / JSON)
   Same JSON model underneath; the point is that any use case can be viewed
   any way, and the data never changes when you switch views.

   Element model (board > column > tray > note):
     board  — root; hosts columns + trays
     column — full vertical slot in a board; hosts trays + notes
     tray   — recursively composable; hosts trays + notes
     note   — a markdown slip; stacks with sub-notes but is not a container
   ========================================================================= */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Datasets — one per use case. Each is a Flexity board model.
   // Notes are pure markdown (body field). Sub-notes stack underneath with
   // spacing, like markdown list levels — under but not inside the parent.
   // ---------------------------------------------------------------------
  const datasets = {
    tasks: {
      label: "Tasks",
      hint: "GTD-style task tracking",
      board: {
        type: "board", title: "Tasks",
        children: [
          { type: "column", title: "Today", children: [
            { type: "note", body: "Review PR #42", children: [
              { type: "note", body: "**Backend auth changes.**" },
              { type: "note", body: "## Checklist\n1. Token refresh\n2. Session invalidation\n3. Error handling" }
            ]},
            { type: "note", body: "Reply to design feedback", children: [
              { type: "note", body: "- [ ] Address contrast\n- [x] Update mockups" }
            ]}
          ]},
          { type: "tray", title: "Next", children: [
            { type: "note", body: "Draft Q3 roadmap", children: [
              { type: "note", body: "Three themes for Q3:\n\n1. Performance\n2. Onboarding\n3. Mobile\n\nSee [planning doc](https://example.com)." }
            ]},
            { type: "note", body: "Migrate docs" }
          ]},
          { type: "tray", title: "Waiting", children: [
            { type: "note", body: "Vendor contract", children: [
              { type: "note", body: "On legal since *Monday*." }
            ]}
          ]},
          { type: "tray", title: "Someday", children: [
            { type: "note", body: "Learn Rust" },
            { type: "note", body: "Write a CLI tool" }
          ]},
          { type: "tray", title: "Errands", children: [
            { type: "note", body: "- [ ] Pick up dry cleaning\n- [ ] Buy stamps" }
          ]},
          { type: "tray", title: "Done", children: [
            { type: "note", body: "Ship v2.1", children: [
              { type: "note", body: "~~Bug #123~~ fixed." }
            ]}
          ]}
        ]
      }
    },
    project: {
      label: "Project",
      hint: "Traditional Kanban — all columns",
      board: {
        type: "board", title: "Site redesign",
        children: [
          { type: "column", title: "Backlog", children: [
            { type: "tray", title: "Audit current pages", children: [
              { type: "note", body: "Home" },
              { type: "note", body: "Pricing" },
              { type: "note", body: "Docs" }
            ]},
            { type: "note", body: "Stakeholder interviews", children: [
              { type: "note", body: "Schedule ~5 calls.\n\nFocus on *pain points*, not feature requests." }
            ]}
          ]},
          { type: "column", title: "In progress", children: [
            { type: "tray", title: "Design system", children: [
              { type: "note", body: "Color tokens" },
              { type: "note", body: "Type scale" }
            ]},
            { type: "note", body: "Homepage hero", children: [
              { type: "note", body: "## Variants\n| Option | CTA |\n|---|---|\n| A | Start free |\n| B | Book a demo |\n| C | See pricing |" }
            ]}
          ]},
          { type: "column", title: "Review", children: [
            { type: "note", body: "Footer redesign", children: [
              { type: "note", body: "- [ ] Mobile layout\n- [ ] Dark mode" }
            ]}
          ]},
          { type: "column", title: "Done", children: [
            { type: "note", body: "Kickoff doc" }
          ]}
        ]
      }
    },
    ideas: {
      label: "Ideas",
      hint: "Inspirations — columns categorize, trays hold each idea",
      board: {
        type: "board", title: "Ideas",
        children: [
          { type: "column", title: "Sparks", children: [
            { type: "tray", title: "Weekly digest email" },
            { type: "tray", title: "Voice capture" }
          ]},
          { type: "column", title: "Exploring", children: [
            { type: "tray", title: "Public profile pages", children: [
              { type: "note", body: "Share a curated board. See [example](https://example.com)." }
            ]},
            { type: "tray", title: "Calendar view", children: [
              { type: "note", body: "Notes with dates on a *timeline*." }
            ]}
          ]},
          { type: "column", title: "Shaping", children: [
            { type: "tray", title: "Templates", children: [
              { type: "note", body: "Pre-built boards for common flows." }
            ]}
          ]},
          { type: "column", title: "Kept", children: [
            { type: "tray", title: "Keyboard-first nav" }
          ]}
        ]
      }
    },
    sop: {
      label: "SOP",
      hint: "Ordered procedure — all trays, reads best as an outline",
      board: {
        type: "board", title: "Release a feature",
        children: [
          { type: "tray", title: "1. Prepare", children: [
            { type: "note", body: "Open a tracking issue", children: [
              { type: "note", body: "Scope + acceptance criteria." }
            ]},
            { type: "note", body: "Branch from main", children: [
              { type: "note", body: "Name it `feat/<short>`." }
            ]}
          ]},
          { type: "tray", title: "2. Build", children: [
            { type: "note", body: "Implement" },
            { type: "note", body: "Write tests", children: [
              { type: "note", body: "1. Happy path\n2. Auth failure\n3. Rate limit edge case" }
            ]}
          ]},
          { type: "tray", title: "3. Review", children: [
            { type: "note", body: "Self-review the diff" },
            { type: "note", body: "Request review" }
          ]},
          { type: "tray", title: "4. Ship", children: [
            { type: "note", body: "Merge + deploy", children: [
              { type: "note", body: "Squash-merge to main." }
            ]},
            { type: "note", body: "Close the issue" }
          ]},
          { type: "tray", title: "5. Monitor", children: [
            { type: "note", body: "Watch error logs for 24h" },
            { type: "note", body: "Check metrics dashboard" }
          ]},
          { type: "tray", title: "6. Document", children: [
            { type: "note", body: "Update changelog" },
            { type: "note", body: "Write retro note" }
          ]}
        ]
      }
    }
  };

  // ---------------------------------------------------------------------
  // State: which dataset, which view.
  // ---------------------------------------------------------------------
  let currentCase = "tasks";
  let currentView = "board";

  const pane = document.getElementById("viewer-pane");
  const caseTabs = document.querySelectorAll('[data-case]');
  const viewTabs = document.querySelectorAll('[data-view]');
  const caseLabel = document.getElementById("viewer-case-label");

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const model = () => datasets[currentCase].board;

  // Extract a short label from a node for tree/outline views.
  // Notes use the first line of their markdown body (stripped of syntax).
  const label = (n) => {
    if (n.type === "note") {
      const first = (n.body || "").split("\n")[0];
      return first.replace(/^#+\s*/, "").replace(/[*_`~\[\]]/g, "").trim() || "(note)";
    }
    return n.title || "(untitled)";
  };

  // ---------------------------------------------------------------------
  // Markdown renderer (compact, for the mini preview)
  // Supports: headings (## / ###), bold, italic, strikethrough, inline code,
  // links, unordered lists, numbered lists, checkboxes, tables, and paragraphs.
  // ---------------------------------------------------------------------
  function md(text) {
    if (!text) return "";
    const inline = (s) =>
      s
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
        .replace(/~~([^~]+)~~/g, "<del>$1</del>");
    const lines = String(text).split("\n");
    let html = "";
    let i = 0;
    let inUL = false, inOL = false, inCheck = false;
    const closeLists = () => {
      if (inUL) { html += "</ul>"; inUL = false; }
      if (inOL) { html += "</ol>"; inOL = false; }
      if (inCheck) { html += "</ul>"; inCheck = false; }
    };
    while (i < lines.length) {
      const line = esc(lines[i]);
      // Headings
      const h4 = line.match(/^###\s+(.+)$/);
      const h3 = line.match(/^##\s+(.+)$/);
      if (h4) { closeLists(); html += `<h4>${inline(h4[1])}</h4>`; i++; continue; }
      if (h3) { closeLists(); html += `<h3>${inline(h3[1])}</h3>`; i++; continue; }
      // Table: header row followed by separator row
      if (/^\s*\|.*\|\s*$/.test(lines[i]) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        closeLists();
        const headerCells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        let rows = "";
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          const cells = lines[i].split("|").slice(1, -1).map((c) => inline(esc(c).trim()));
          rows += `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
          i++;
        }
        const thead = `<thead><tr>${headerCells.map((c) => `<th>${inline(esc(c))}</th>`).join("")}</tr></thead>`;
        html += `<table>${thead}<tbody>${rows}</tbody></table>`;
        continue;
      }
      // Checkboxes
      const check = line.match(/^\s*-\s+\[([ x])\]\s+(.+)$/);
      if (check) {
        if (inUL) { html += "</ul>"; inUL = false; }
        if (inOL) { html += "</ol>"; inOL = false; }
        if (!inCheck) { html += '<ul class="md-check">'; inCheck = true; }
        const done = check[1] === "x";
        html += `<li class="md-check-item${done ? " is-done" : ""}"><span class="md-box">${done ? "✓" : ""}</span>${inline(check[2])}</li>`;
        i++; continue;
      }
      // Bullet list
      const li = line.match(/^\s*[-*]\s+(.+)$/);
      if (li) {
        if (inCheck) { html += "</ul>"; inCheck = false; }
        if (inOL) { html += "</ol>"; inOL = false; }
        if (!inUL) { html += "<ul>"; inUL = true; }
        html += `<li>${inline(li[1])}</li>`;
        i++; continue;
      }
      // Numbered list
      const ol = line.match(/^\s*\d+\.\s+(.+)$/);
      if (ol) {
        if (inCheck) { html += "</ul>"; inCheck = false; }
        if (inUL) { html += "</ul>"; inUL = false; }
        if (!inOL) { html += "<ol>"; inOL = true; }
        html += `<li>${inline(ol[1])}</li>`;
        i++; continue;
      }
      // Paragraph
      closeLists();
      if (line.trim() === "") { i++; continue; }
      html += `<p>${inline(line)}</p>`;
      i++;
    }
    closeLists();
    return html;
  }

  // ---------------------------------------------------------------------
  // View: Board (mini Kanban with masonry trays)
  // Root items flow horizontally first. Columns each take one slot.
  // Root trays also take horizontal slots — but when there are more trays
  // than available slots, they stack VERTICALLY in masonry columns.
  // Minimum slots = num_columns + (1 if any root trays), enforced regardless
  // of viewport width (horizontal scroll if narrower).
  // ---------------------------------------------------------------------
  function viewBoard() {
    const renderItem = (item) => {
      if (item.type === "tray") {
        const kids = (item.children || []).map(renderItem).join("");
        return `<div class="minotray"><div class="minotray__h">${esc(item.title)}</div>${kids ? `<div class="minotray__body">${kids}</div>` : ""}</div>`;
      }
      // note — pure markdown, full rectangle
      const body = `<div class="minicard__md">${md(item.body)}</div>`;
      const subs = (item.children || []).length
        ? `<div class="mininote-subs">${item.children.map(renderItem).join("")}</div>`
        : "";
      return `<div class="mininote-group"><div class="minicard">${body}</div>${subs}</div>`;
    };

    const root = model().children;
    const columns = root.filter((c) => c.type === "column");
    const trays = root.filter((c) => c.type === "tray");

    // Calculate slot count from the pane's current width.
    // NOTE: measure `pane.clientWidth` (which persists across renders) — NOT
    // `.viewer__scroll`, which is recreated by this very render() call and so
    // would be stale/missing on first paint, causing trays to stack vertically
    // even when there is enough horizontal room.
    const SLOT_W = 200, GAP = 12;
    const minSlots = columns.length + (trays.length > 0 ? 1 : 0);
    const containerW = pane.clientWidth || 600;
    const slots = Math.max(Math.floor((containerW + GAP) / (SLOT_W + GAP)), minSlots);

    // Tray masonry groups: each group is a vertical stack of trays
    let groupCount = 0;
    if (trays.length > 0) {
      groupCount = Math.min(Math.max(slots - columns.length, 1), trays.length);
    }
    const groups = Array.from({ length: groupCount }, () => []);
    trays.forEach((t, i) => groups[i % groupCount].push(t));

    // Board min-width: enforce minimum horizontal slots (scroll if viewport narrower)
    const boardMinWidth = slots * SLOT_W + (slots - 1) * GAP;

    // Render columns (each takes one horizontal slot, stretches to full height)
    const colEls = columns.map((col) => {
      const items = (col.children || []).map(renderItem).join("");
      return `<div class="minicol"><div class="minicol__h">${esc(col.title)}</div><div class="minicol__body">${items}</div></div>`;
    }).join("");

    // Render tray masonry groups (each group takes one horizontal slot, trays stack vertically)
    const groupEls = groups.map((g) =>
      `<div class="minotray-stack">${g.map(renderItem).join("")}</div>`
    ).join("");

    return `<div class="miniboard" style="min-width:${boardMinWidth}px">${colEls}${groupEls}</div>`;
  }

  // ---------------------------------------------------------------------
  // View: Tree (mind-map style — horizontal branching from root)
  // ---------------------------------------------------------------------
  function viewTree() {
    const cls = { board: "mm-node--board", column: "mm-node--column", tray: "mm-node--tray", note: "mm-node--note" };
    const walk = (node) => {
      const kids = node.children || [];
      const nodeEl = `<div class="mm-node ${cls[node.type] || "mm-node--note"}">${esc(label(node))}</div>`;
      if (!kids.length) return nodeEl;
      const branches = kids.map((k) => `<div class="mm-branch">${walk(k)}</div>`).join("");
      return `${nodeEl}<div class="mm-children">${branches}</div>`;
    };
    return `<div class="mindmap">${walk(model())}</div>`;
  }

  // ---------------------------------------------------------------------
  // View: Outline (structural hierarchy with type tags + connector lines)
  // ---------------------------------------------------------------------
  function viewOutline() {
    const glyph = (n) => (n.type === "note" ? "•" : "▾");
    const tag = (n) => `<span class="os-tag os-tag--${n.type}">${n.type}</span>`;
    const walk = (node, depth) => {
      const kids = node.children || [];
      const head = `<div class="os-node" style="padding-left:${depth * 18}px"><span class="os-glyph">${glyph(node)}</span>${tag(node)}<span class="os-label">${esc(label(node))}</span></div>`;
      const body = kids.map((k) => walk(k, depth + 1)).join("");
      return head + (body ? `<div class="os-children">${body}</div>` : "");
    };
    return `<div class="outline-struct">${walk(model(), 0)}</div>`;
  }

  // ---------------------------------------------------------------------
  // View: JSON (the raw model — the data form, combined as last option)
  // ---------------------------------------------------------------------
  function viewJSON() {
    const json = JSON.stringify(model(), null, 2);
    const tinted = esc(json)
      .replace(/&quot;([^&]*?)&quot;:/g, '<span class="k">"$1"</span>:')
      .replace(/: &quot;([^&]*?)&quot;/g, ': <span class="s">"$1"</span>')
      .replace(/: (true|false|null)/g, ': <span class="b">$1</span>');
    return `<div class="viewer__json">${tinted}</div>`;
  }

  const renderers = { board: viewBoard, tree: viewTree, outline: viewOutline, json: viewJSON };

  // ---------------------------------------------------------------------
  // Render + tab wiring
  // ---------------------------------------------------------------------
  function render() {
    pane.innerHTML = `<div class="viewer__scroll">${renderers[currentView]()}</div>`;
    if (caseLabel) caseLabel.textContent = datasets[currentCase].hint;
  }

  function setCase(name) {
    if (!datasets[name]) return;
    currentCase = name;
    caseTabs.forEach((t) => t.setAttribute("aria-selected", t.dataset.case === name ? "true" : "false"));
    render();
  }

  function setView(name) {
    if (!renderers[name]) return;
    currentView = name;
    viewTabs.forEach((t) => t.setAttribute("aria-selected", t.dataset.view === name ? "true" : "false"));
    render();
  }

  caseTabs.forEach((t) => t.addEventListener("click", () => setCase(t.dataset.case)));
  viewTabs.forEach((t) => {
    t.addEventListener("click", () => setView(t.dataset.view));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const list = Array.from(viewTabs);
      const i = list.indexOf(t);
      const next = e.key === "ArrowLeft" ? (i - 1 + list.length) % list.length : (i + 1) % list.length;
      list[next].focus();
      setView(list[next].dataset.view);
    });
  });

  // Re-render board view on viewport resize (masonry slot recalculation)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentView === "board") render();
    }, 100);
  });

  // ---------------------------------------------------------------------
  // Resize handle: drag to adjust the viewer pane width and height
  // ---------------------------------------------------------------------
  const resizeHandle = document.getElementById("viewer-resize");
  const viewerPane = document.getElementById("viewer-pane");
  const viewer = document.getElementById("viewer");
  if (resizeHandle && viewerPane) {
    let dragging = false, startX = 0, startY = 0, startW = 0, startH = 0;
    const MIN_W = 300, MAX_W = 2400, MIN_H = 200, MAX_H = 1200;
    resizeHandle.addEventListener("mousedown", (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = viewer.offsetWidth;
      startH = viewerPane.offsetHeight;
      resizeHandle.classList.add("is-active");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "nwse-resize";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const w = Math.max(MIN_W, Math.min(MAX_W, startW + dx));
      const h = Math.max(MIN_H, Math.min(MAX_H, startH + dy));
      viewer.style.width = w + "px";
      viewer.style.maxWidth = w + "px";
      viewerPane.style.height = h + "px";
      if (currentView === "board") render();
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      resizeHandle.classList.remove("is-active");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    });
  }

  // Initial render.
  render();
})();
