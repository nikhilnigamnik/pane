# pane

A small local code viewer and editor. `pane <folder-or-file>` starts a server on
`127.0.0.1` and opens a browser UI with a file tree, tabs and the Monaco editor.
It is a personal tool in the spirit of px0, but files are editable.

## Commands

Use `pnpm` only, never npm or yarn.

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Vite UI on `:5173` plus the API on `:7879`, serving this repo's own folder |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest, run once |
| `pnpm build` | Build the UI to `dist/web`, then bundle the CLI to `dist/cli.js` |
| `pnpm start <path>` | Run the built CLI |

The global `pane` command is a `pnpm link --global` of this folder and runs
`dist/cli.js`. Source changes do not reach it until `pnpm build` runs again.

## Layout

There is no `src/` directory. Everything lives at the project root.

```
bin/pane.ts          CLI entry, only calls runCli
server/              Node side (Hono)
  cli.ts             argument parsing, port fallback, opens the browser
  app.ts             routes and request guards
  workspace.ts       every disk read and write, with the path checks
  search.ts          text and regex search over the files that workspace.ts lists and reads
  path-filter.ts     include/exclude glob patterns for search
  watcher.ts         watches the opened folder and batches changed paths
  paths.ts           isInside / relative path helpers
  schema.ts          zod schemas for query strings and bodies
  static.ts          serves the built UI
  result.ts          ok() / fail() helpers for Result<T>
web/                 browser side (React)
  app.tsx            page composition and global shortcuts
  components/        feature components (file-tree, file-tree-menu, tab-bar, editor-pane,
                     code-editor, side-pane-header, quick-open, command-palette,
                     search-panel, file-action-dialogs, markdown-preview,
                     image-preview, table-preview, json-preview, ...)
  components/ui/     Cursor-style primitives (button, note, kbd, picker, confirm and
                     prompt dialogs, context menu, scroll area)
  hooks/             use-editor-tabs, use-file-tree, use-file-actions, use-side-view,
                     use-project-search, use-global-shortcuts, use-model-text,
                     use-sidebar-width, use-latest
  lib/               api client, workspace events, Monaco setup, models, editor theme,
                     and pure helpers with tests (fuzzy, path, tree-rows, entry-name,
                     markdown-headings, command-list, delimited, json-tree, preview)
  styles/            cursor-tokens.css (tokens) and index.css (Tailwind theme)
config/              every constant, label, route and message
types/               types shared by server and web
```

`@/` is an alias for the project root (`@/config/server`, `@/web/lib/api`).

## How it fits together

- The server exposes eleven routes under `/api`: `GET meta`, `GET tree?path=`,
  `GET file?path=`, `PUT file`, `GET events`, `GET files`, `GET search?query=`,
  `GET raw?path=`, and `POST create`, `POST rename` and `POST delete`. Paths are
  relative to the opened folder.
- Every route answers with `Result<T>` from `types/api.ts`
  (`{ success, data }` or `{ success, error: { code, message } }`), also on
  error statuses. Server functions return results instead of throwing.
- The UI keeps one Monaco model per open file (`web/lib/models.ts`) and a
  single editor instance that swaps models when the tab changes.
- A tab is dirty when the model's alternative version id differs from the one
  recorded at the last load or save, so undoing back to the saved text makes
  it clean again.
- Saving sends `expectedMtimeMs`. If the file changed on disk the server
  answers `conflict` and the UI offers Reload or Overwrite.
- `GET events` is a server-sent event stream of changed paths, batched every
  100 ms (`server/watcher.ts`). The browser keeps one shared connection
  (`web/lib/workspace-events.ts`). Folders on screen reload their listing,
  untouched tabs reload silently, and tabs with unsaved edits show the conflict
  banner. After a reconnect everything on screen is re-checked.
- The refresh button closes every open folder and reloads the top level.
- The command palette (Cmd+Shift+P) lists every action with its shortcut.
  The list is built by `buildCommands` in `web/lib/command-list.ts` from the
  same `CommandActions` the global shortcuts call, and leaves out commands
  that cannot run right now. A new action belongs in both places. Quick open
  and the palette share `ui/picker.tsx`, which closes its dialog before running
  the choice so a dialog the choice opens keeps the keyboard.
- Quick open (Cmd+P) fetches `GET files`, the flat list of every file, each
  time it opens and ranks it in the browser with `web/lib/fuzzy.ts` (the fzy
  scoring). Open tabs are listed first while nothing is typed.
- Search (Cmd+Shift+F) swaps the sidebar to a search view. `GET search` takes
  plain text or a JavaScript regular expression, can match whole words only,
  and can be limited with comma-separated include and exclude globs
  (`server/path-filter.ts`: a pattern without a slash matches any file or
  folder name, one with a slash matches the path). It reads files through the
  same `readFile` the editor uses and stops at 1000 matches. A match that runs
  over several lines is marked on its first line only. The browser waits
  250 ms after the last change and cancels the request it replaces. Clicking a
  match opens the file with the match selected (`RevealRequest` in
  `types/editor.ts`).
- Go to line (Ctrl+G on every platform) and go to symbol (Cmd+Shift+O) open
  Monaco's own pickers through `ActionRequest`, on the view used last. Symbols
  come from Monaco's language workers; Markdown headings come from
  `web/lib/markdown-headings.ts`, registered in `web/lib/monaco-setup.ts`.
- Files and folders are created, renamed and deleted from the tree: the
  header buttons, a right-click menu (`file-tree-menu.tsx`), F2 to rename and
  Delete or Cmd+Backspace to delete. Names are entered in a dialog
  (`ui/prompt-dialog.tsx`) and checked by `web/lib/entry-name.ts`.
  `use-file-actions.ts` calls the API, then moves open tabs, open folders and
  the side view to the new paths. Renaming a file gives its tab a new Monaco
  model (`moveModel`), so its undo history starts over. Deleting closes its
  tabs, unsaved or not, after a confirmation that says so. Deleted files do
  not go to the trash.
- The side view (Cmd+\\, the split button in the tab bar, or "Open to the side"
  in the tree menu) shows a second file to the right of the tabs. It always
  shows a file that is also open as a tab, so both editors share one Monaco
  model, and it closes when that tab closes. Markdown and SVG open there as a
  live preview next to their source. Save, preview, go to line and go to
  symbol act on whichever view was used last (`PaneId`), and the status bar
  follows it.
- Quick open and search skip `.git` plus the folders in
  `INDEX_SKIPPED_DIRECTORY_NAMES` (`node_modules`, `dist`, `build`, ...) and do
  not follow symlinks. `.gitignore` is not read. The file tree still shows
  everything.
- The file tree follows the usual tree keys: up, down, Home and End move, right
  opens a folder and then steps in, left closes it and then steps out. Only one
  row is in the tab order. The key logic is pure and lives in
  `web/lib/tree-rows.ts`.
- A tab is `text` or `image` (`TabKind`). Raster images open as picture-only
  tabs that load through `GET raw` and reload when the file changes. Markdown,
  SVG, JSON, CSV and TSV are text tabs with a Preview toggle (Cmd+Shift+V) that
  renders the text in the editor, unsaved edits included (`previewKind` in
  `web/lib/preview.ts`). CSV and TSV show as a table whose first row is the
  header; clicking a header sorts up, down, then back to file order, and only
  the first 1000 rows are drawn though sorting covers all of them. JSON shows
  as a tree, open two levels deep, with long arrays and objects shown 200
  entries at a time. Both parse a deferred copy of the text, so typing in a
  large file does not lag. While a preview is up the editor
  is `invisible`, so it cannot take key presses.
- Keyboard shortcuts are declared in `config/shortcuts.ts` and handled in
  `web/hooks/use-global-shortcuts.ts`. A `command` shortcut answers only to
  Cmd on a Mac, because Ctrl+P and friends are text-editing keys there. Handled
  shortcuts stop propagating, so Monaco's own bindings for the same keys do
  not run a second time.
- The sidebar is resized from its right edge (drag, arrow keys, double-click
  to reset). The width is kept in `localStorage` and applied through the
  `--sidebar-width` CSS variable on the sidebar, which keeps Tailwind classes
  the only styling and avoids re-rendering the tree while dragging.

## Conventions

- TypeScript only. Named exports, no default exports (config files for tools
  are the exception).
- `interface` for object shapes and props, `type` only for unions and
  utility types. Never `any`.
- Files in `kebab-case`. Booleans start with `is`, `has` or `should`.
- No hardcoded labels, URLs, ports or limits in logic or components. Put them
  in `config/` as `UPPER_SNAKE_CASE`.
- Tailwind classes only. No CSS modules, no inline style objects.
- Validate input with zod at the server boundary, not inside business logic.
- Prefer early returns and `async`/`await` over `.then()` chains.
- Import order: external packages, then `@/` aliases, then relative imports,
  with a blank line between groups.
- Comment only what is not obvious from the code.
- Keep files under roughly 500 lines.
- Never use em dashes or en dashes anywhere. Use a plain hyphen.
- Tests are colocated as `<name>.test.ts` and use Vitest.
- Commits follow conventional commits (`feat(server): ...`). Never commit
  without being asked, and never add `Co-Authored-By` lines.

## Design system

The UI follows the design of cursor.com and is dark only. There is no light
theme and no theme toggle.

- `web/styles/cursor-tokens.css` is the single source of truth for color. The
  values were copied from the dark theme in the stylesheet behind cursor.com
  (its `--color-theme-*` and `--theme-*` variables). Translucent colors are
  written as 8-digit hex instead of Cursor's `color-mix()`, because the Monaco
  theme can only read plain colors.
- `web/styles/index.css` maps the tokens into Tailwind and removes Tailwind's
  default palette, text sizes, shadows and radii. Use Cursor's names:
  `bg-theme-product-chrome`, `bg-theme-product-editor`, `text-theme-text-sec`,
  `border-theme-border-02`, `bg-theme-fg-08`, `text-theme-accent`,
  `text-product-lg`, `text-sm`, `shadow-focus-ring`.
- Chrome (sidebar, tab bar, status bar) uses `product-chrome` and the editor
  area uses `product-editor`.
- Never write raw hex colors in components.
- Fonts are system fonts, like Cursor's product UI: `system-ui` for the
  interface and `ui-monospace` for code. Cursor's own code font, Berkeley
  Mono, is a paid font; it is listed first so it is used when installed, and
  it is never bundled. No web fonts are loaded.
- Buttons are pill-shaped and regular weight, as on cursor.com.
- Scrollable chrome uses `ScrollArea` from `web/components/ui/` (Radix
  ScrollArea) instead of the browser scrollbar.
- `ScrollArea` takes `isHorizontal` for content that is wider than the area,
  such as the table preview.
- Rendered Markdown is styled element by element in
  `web/components/markdown-preview.tsx`, with headings on Cursor's `text-md-sm`,
  `text-md` and `text-md-lg` sizes. Fenced code is colored by Monaco's own
  tokenizer, so it matches the editor.
- Context menus use `ContextMenu` from `web/components/ui/` (Radix
  ContextMenu). Dialogs are native `<dialog>` elements.
- Toggle buttons pass `isPressed` to `Button`. Do not override its colors or
  padding through `className`: there is no class merging, so the override can
  lose to the class it was meant to replace.
- Icons come from `lucide-react`, sized with `ICON_SIZE` and
  `ICON_STROKE_WIDTH` from `config/ui.ts`. Cursor does not publish its icons
  or components, so the primitives in `web/components/ui/` are written here
  on top of the real tokens.
- The Monaco theme is generated from the same tokens. Token-to-color mapping
  lives in `config/editor.ts`. cursor.com publishes no syntax colors, so the
  syntax roles are mapped onto its named palette (keywords orange, strings
  green, constants blue, functions and types lavender).

## Security rules (do not weaken)

This server can read and write files, so these hold for every change:

- Listen on `127.0.0.1` only.
- Reject requests whose `Host` is not a loopback name (blocks DNS rebinding).
- Reject `/api` calls with a non-loopback `Origin` or a cross-site
  `Sec-Fetch-Site`, and require `application/json` on writes.
- All disk access goes through `resolveInside` in `server/workspace.ts`,
  which checks the path both as written and after resolving symlinks.
  Create, rename and delete go through `resolveEntryInside`, which resolves the
  parent folder with `resolveInside` but never follows the last part of the
  path, so renaming or deleting a symlink acts on the link and never on what
  it points to.
- `PUT file` only writes files that already exist. New files and folders come
  only from `POST create`, which never overwrites. `POST rename` never
  replaces an existing entry (a change of case only is allowed). None of the
  three touch the opened folder itself, or `.git` and the other
  `IGNORED_ENTRY_NAMES`, and all three take JSON bodies like every other
  write.
- Any new route that touches disk needs cases in `server/workspace.test.ts`
  and `server/app.test.ts`, including an attempt to escape the workspace.
- The events route reports changed paths only, never contents. Readers still
  fetch through the guarded routes. Its tests live in `server/watcher.test.ts`.
- `POST delete` removes folders recursively and does not use the trash. The UI
  must always confirm first.
- `GET files` and `GET search` take no path. They walk from the root, resolve
  every folder through `resolveInside`, and neither follow nor list symlinks.
  Search reads only through `readFile`, so it can never see more than the
  editor can open. Its tests live in `server/search.test.ts` and
  `server/path-filter.test.ts`. A regular expression runs on the server's
  main thread, so a pathological one can stall the server; the query is the
  user's own, on their own machine.
- `GET raw` serves bytes only for the image extensions in `config/preview.ts`,
  with the content type from that list. Every raw response carries a sandbox
  Content-Security-Policy, `nosniff` and a same-origin resource policy, because
  an SVG opened as a page would otherwise run scripts with access to the API.
- Markdown is rendered with `react-markdown` without raw HTML support, so HTML
  in a file shows as text. Do not add `rehype-raw`. Relative links and images
  are resolved by `resolveRelativePath`, which refuses paths above the root.
- SVG is only ever drawn inside an `<img>`, where browsers do not run its
  scripts. Do not inline SVG markup from a file into the page.

## Gotchas

- The production build shortens hex values in the token CSS (`#000000`
  becomes `#000`). Monaco rejects short hex, so `web/lib/editor-theme.ts`
  normalizes colors through a canvas. Dev mode does not show this problem;
  check editor theme changes against `pnpm build`.
- Monaco drops the alpha of syntax colors. `web/lib/editor-theme.ts` blends
  translucent tokens (secondary text is the foreground at 60 percent) over
  the editor background before handing them to Monaco.
- On macOS `fs.watch` reports a change to the opened folder itself under the
  folder's own name. The watcher passes it through; it only costs an extra
  refresh of the top level.
- Radix ScrollArea wraps content in a `display: table` div, which stops
  `truncate` from working. `ScrollArea` forces that wrapper to `block`. Its
  scrollbar only mounts once the browser renders a frame, so it never shows
  in a hidden or background tab.
- Monaco tells editors about an undo before it restores the version id that
  marks the text as saved. `web/components/code-editor.tsx` therefore runs the
  dirty check in a microtask. Reading the id inside the event leaves a tab
  marked unsaved after undoing back to the saved text.
- Monaco's `colorize` returns non-breaking spaces. The Markdown code block
  turns them back into spaces so copied code is not corrupted.
- An open modal `<dialog>` makes the rest of the page inert, so `focus()` on
  the editor silently fails until it closes. Quick open and the prompt dialog
  open and close in layout effects for that reason.
- Monaco's pickers close when the editor takes focus. In
  `web/components/code-editor.tsx` the effect that runs an `ActionRequest`
  must stay after the one that focuses the editor when a preview closes.
- The TypeScript worker starts on first use, so the first go-to-symbol in a
  session can take a moment to list anything.
- `ScrollArea` passes extra props and its ref to the Radix root, which is what
  lets it be the trigger of the tree's context menu.
- Adding or removing hooks in a custom hook breaks hot reload with a "change
  in the order of Hooks" error and a blank page. Reload the page.
- Monaco 0.57 ignores `bracketPairColorization` in editor options. It is set
  per model in `web/lib/models.ts`.
- Monaco 0.57 worker imports are `monaco-editor/editor/editor.worker?worker`
  (not `esm/vs/...`), and TypeScript settings live at `monaco.typescript`.
- `vite.config.ts` imports `./config/routes.ts` and `./config/server.ts` with
  the extension. Those two config files must not gain runtime `@/` imports
  (type-only imports are fine).
- `tsup` runs with `clean: false` because Vite writes `dist/web` first.
- React StrictMode runs effects twice in dev. Effects must tolerate that.

## Verifying a change

1. `pnpm typecheck` and `pnpm test`.
2. `pnpm build`.
3. `node dist/cli.js . --no-open`, then open the printed URL and exercise the
   change in a browser. The UI has no component tests yet,
   so this step is the only check for it.

## Not built yet

- Replace in files.
- JSON with comments (`tsconfig.json`): the JSON preview reports it as invalid.
- Reading `.gitignore` for quick open and search.
- Git changed-files list and diff view.
- Moving files by drag and drop, undoing a delete, and resizing the side view.
- Text files over 2 MB, images over 20 MB and other binary files are refused
  on purpose.
- Radix ScrollArea puts an inline `position: relative` on its root, which
  beats an `absolute` class. A ScrollArea that has to fill a positioned pane
  goes inside an `absolute inset-0` wrapper with `size-full` on itself;
  otherwise it grows to its content and never scrolls.
