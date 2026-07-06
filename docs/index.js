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
              { type: "note", body: "Check `auth.ts` for the new token flow." }
            ]},
            { type: "note", body: "Reply to design feedback", children: [
              { type: "note", body: "- [ ] Address contrast\n- [x] Update mockups" }
            ]}
          ]},
          { type: "tray", title: "Next", children: [
            { type: "note", body: "Draft Q3 roadmap", children: [
              { type: "note", body: "See [planning doc](https://example.com)." }
            ]},
            { type: "note", body: "Migrate docs" }
          ]},
          { type: "tray", title: "Waiting", children: [
            { type: "note", body: "Vendor contract", children: [
              { type: "note", body: "On legal since *Monday*." }
            ]}
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
              { type: "note", body: "Schedule ~5 calls." }
            ]}
          ]},
          { type: "column", title: "In progress", children: [
            { type: "tray", title: "Design system", children: [
              { type: "note", body: "Color tokens" },
              { type: "note", body: "Type scale" }
            ]},
            { type: "note", body: "Homepage hero", children: [
              { type: "note", body: "**Hero copy** + CTA." }
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
              { type: "note", body: "Happy path + one edge case." }
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
  // links, unordered lists, and checkboxes.
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
    let inUL = false, inCheck = false;
    const closeLists = () => {
      if (inUL) { html += "</ul>"; inUL = false; }
      if (inCheck) { html += "</ul>"; inCheck = false; }
    };
    for (const raw of lines) {
      const line = esc(raw);
      const h3 = line.match(/^##\s+(.+)$/);
      const h4 = line.match(/^###\s+(.+)$/);
      if (h4) { closeLists(); html += `<h4>${inline(h4[1])}</h4>`; continue; }
      if (h3) { closeLists(); html += `<h3>${inline(h3[1])}</h3>`; continue; }
      const check = line.match(/^\s*-\s+\[([ x])\]\s+(.+)$/);
      if (check) {
        if (inUL) { html += "</ul>"; inUL = false; }
        if (!inCheck) { html += '<ul class="md-check">'; inCheck = true; }
        const done = check[1] === "x";
        html += `<li class="md-check-item${done ? " is-done" : ""}"><span class="md-box">${done ? "✓" : ""}</span>${inline(check[2])}</li>`;
        continue;
      }
      const li = line.match(/^\s*[-*]\s+(.+)$/);
      if (li) {
        if (inCheck) { html += "</ul>"; inCheck = false; }
        if (!inUL) { html += "<ul>"; inUL = true; }
        html += `<li>${inline(li[1])}</li>`;
        continue;
      }
      closeLists();
      if (line.trim() === "") continue;
      html += `<p>${inline(line)}</p>`;
    }
    closeLists();
    return html;
  }

  // ---------------------------------------------------------------------
  // View: Board (mini Kanban)
  // Columns stretch to full container height; trays size to their content.
  // Notes are pure markdown rectangles. Sub-notes stack underneath the parent
  // note with indentation — under but not inside, like markdown list levels.
  // Empty trays have no placeholder.
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

    const blocks = model().children
      .map((child) => {
        if (child.type === "column") {
          const items = (child.children || []).map(renderItem).join("");
          return `<div class="minicol"><div class="minicol__h">${esc(child.title)}</div><div class="minicol__body">${items}</div></div>`;
        }
        // tray at root — flexible height
        return renderItem(child);
      })
      .join("");
    return `<div class="miniboard">${blocks}</div>`;
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

  // Initial render.
  render();
})();
