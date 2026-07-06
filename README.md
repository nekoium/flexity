# flexity
Flexity is a JSON-native, markdown-first information model for knowledge management. Inspired by the Kanban system, Flexity provides a structured way to organize information into recursively composable objects that can be viewed as knowledge outlines, idea or project trackers, SOPs, or other interpretations without changing the underlying data.

## Core model

Flexity's data is built from four composable elements, ordered from largest to smallest: **board**, **column**, **tray**, and **note**.

- A **board** is the root container. It hosts columns and trays.
- A **column** occupies a full vertical slot within a board. It can host trays and notes — it is, in effect, a larger tray — but it cannot be hosted by other elements, because it always takes a full vertical slot and must therefore sit at the board level.
- A **tray** is a recursively composable container. Trays can host other trays and notes, allowing arbitrary nesting.
- A **note** is a markdown slip with full markdown support. Notes can stack — like different levels of a markdown list, separated by spacing — but they cannot host other notes.

Everything is JSON-native: each element is a node in a single tree, and the same tree can be re-viewed as an outline, a board, a tracker, or an SOP without changing the underlying data.
