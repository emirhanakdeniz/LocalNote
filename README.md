# LocalNote

<p align="center">
  <img src="public/app-icon.png" width="128" height="128" alt="LocalNote Icon" />
</p>

<p align="center">
  <strong>A fast, private, and local-only desktop block-based note-taking application.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a> •
  <a href="#technology-stack">Tech Stack</a> •
  <a href="#installation">Installation</a> •
  <a href="#building-from-source">Building from Source</a> •
  <a href="#architecture--data-safety">Architecture</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**LocalNote** is a lightweight, local-only desktop note-taking application built for focus, speed, and privacy. It brings the familiar, flexible block-based editing experience of modern productivity tools to your desktop—completely stripped of accounts, cloud syncing, telemetry, subscriptions, and remote server dependencies.

Your thoughts, code snippets, and project plans belong to you. LocalNote stores everything locally in a high-performance SQLite database on your own machine.

---

## Features

### 📝 Block-Based Writing
- **Rich Block Types**: Paragraphs, Headings (H1, H2, H3), Bullet Lists, Numbered Lists, Checklists (Todos), Blockquotes, and Dividers.
- **Slash Commands (`/`)**: Type `/` to open the command palette and insert blocks rapidly without leaving the keyboard.
- **Markdown Shortcuts**: Use standard markdown symbols (`#`, `##`, `*`, `-`, `1.`, `[]`, `>`) for seamless auto-formatting while typing.
- **Inline Formatting**: Bold, italic, underline, strikethrough, inline code, and hyperlinking.
- **Block Duplication (`Ctrl+D`)**: Duplicate the active block instantly.
- **Drag Handles & Transformations**: Six-dot side drag handles with right-click / menu transformations into any compatible block type.

### 🎨 Modern Code Blocks & Syntax Highlighting
- **2026-Era Soft Contrast Palettes**: Meticulously balanced colors (lavenders, teals, soft greens, muted blues) tailored for reading comfort in both light and dark themes.
- **Powered by Shiki 4.4.3**: Local syntax highlighting engine supporting TypeScript, JavaScript, Python, Rust, HTML, CSS, SQL, Shell, JSON, and more without network calls.
- **Interactive Language Picker**: Searchable, keyboard-accessible language selector flyout.

### 🔍 Instant Local Search (`Ctrl+P`)
- **SQLite FTS5 Full-Text Search**: Search across both page titles and complete note contents with millisecond response times.
- **Keyboard-First Navigation**: Arrow-key traversal, cyclic wrap-around, and instant `Enter` selection.

### 🗂️ Hierarchy, Organization & Trash
- **Nested Pages**: Create deep multi-level hierarchies of notes with cycle-prevention safety.
- **Favorites**: Star frequently visited notes for quick one-click access in the sidebar.
- **Collapsible Sidebar (`Ctrl+\`)**: Toggle between expanded navigation and an ultra-clean, full-width distraction-free writing canvas.
- **Two-Stage Delete Protection**: Deliberate confirmation modals for deletions, with a dedicated **Trash** surface to restore notes or permanently purge them.

### 🎨 Themes & Custom Accent Palettes
- **Light, Dark, and System Themes**: High-contrast legibility with restrained surface geometry.
- **Curated Accent Presets**: Deep Purple, Royal Aubergine, Emerald Forest, Deep Teal, Midnight Navy, and Slate Blue—plus full custom HEX color input.

### 🛡️ Ironclad Data Safety
- **Debounced Autosave**: Automatic background persistence with a serialized write queue preventing race conditions.
- **Flush-Before-Load**: Switching between pages flushes pending in-memory edits before loading new notes.
- **Window Close Protection**: Intercepts native close events to ensure in-flight keystrokes are committed to disk before exit.
- **Non-Destructive Recovery**: Malformed documents are never silently wiped; original content is preserved and autosave is locked safely.

### 📤 Markdown Export
- Export any note to standard `.md` format with sanitized, OS-safe file naming at the click of a button.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + P` | Open Quick Search (FTS5 search across all notes) |
| `Ctrl + N` | Create a new page at the root level |
| `Ctrl + \` | Collapse / Expand sidebar |
| `Ctrl + D` | Duplicate the active editor block |
| `Ctrl + B` | Toggle **bold** formatting |
| `Ctrl + I` | Toggle *italic* formatting |
| `Ctrl + K` | Insert / edit link |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo |
| `/` | Open slash command palette |
| `Tab` / `Shift + Tab` | Indent / Unindent list items |
| `Enter` | Create new paragraph block |
| `Shift + Enter` | Insert soft line break within current block |
| `Esc` | Close search, popovers, or dialogs |

---

## Technology Stack

LocalNote is engineered with a modern, lightweight native desktop stack:

- **Desktop Runtime**: [Tauri 2](https://v2.tauri.app/) (Rust + OS WebView2)
- **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Editor Foundation**: [BlockNote](https://www.blocknotejs.org/) (ProseMirror architecture)
- **Syntax Highlighter**: [Shiki 4.4.3](https://shiki.style/) (Local TextMate grammars)
- **Database & Storage**: Embedded [SQLite](https://sqlite.org/) with FTS5 and WAL mode via [`rusqlite`](https://github.com/rusqlite/rusqlite)
- **Test Suites**: [Vitest](https://vitest.dev/), React Testing Library, and Rust `cargo test`

---

## Installation

### Pre-built Binaries (Windows)

Download the latest release from the **[Releases](../../releases)** page:
- **`LocalNote_1.0.0_x64-setup.exe`**: Standard Windows installer (NSIS).
- **`localnote.exe`**: Portable standalone executable.

---

## Building from Source

### Prerequisites

1. **Windows 10 / 11** with Microsoft Edge WebView2 (pre-installed on modern Windows).
2. **Node.js 20.19+** or **22.12+** LTS and `npm`.
3. **Rust stable toolchain** (`x86_64-pc-windows-msvc`).
4. **Microsoft C++ Build Tools** with the "Desktop development with C++" workload.

### 1. Clone the Repository

```powershell
git clone https://github.com/your-username/LocalNote.git
cd LocalNote
```

### 2. Install Dependencies

```powershell
npm install
```

### 3. Run in Development Mode

```powershell
npm run tauri dev
```

### 4. Build Production Executable & Installer

```powershell
npm run tauri build
```

The compiled binaries will be output to:
- Standalone Executable: `src-tauri/target/release/localnote.exe`
- Installer Bundle: `src-tauri/target/release/bundle/nsis/LocalNote_1.0.0_x64-setup.exe`

### 5. Running the Test Suite

```powershell
# Run frontend unit & reliability tests
npm run test -- --run

# Run TypeScript type check
npm run typecheck

# Run ESLint
npm run lint

# Run Rust backend unit & stress tests
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## Architecture & Data Safety

```
┌────────────────────────────────────────────────────────┐
│                   LocalNote Frontend                   │
│         (React 19 + BlockNote 0.53 + Shiki 4.4)        │
└───────────────────────────┬────────────────────────────┘
                            │ Typed Tauri IPC (No Web APIs)
┌───────────────────────────▼────────────────────────────┐
│                    Tauri Core (Rust)                   │
│         Security-Restricted Native Commands            │
└───────────────────────────┬────────────────────────────┘
                            │ Embedded SQLite with WAL Mode
┌───────────────────────────▼────────────────────────────┐
│                    Local Storage                       │
│    %APPDATA%\com.localnote.desktop\localnote.db        │
│   ├── pages (hierarchy, favorites, soft-delete)        │
│   ├── documents (serialized BlockNote JSON)            │
│   ├── page_search (SQLite FTS5 full-text index)        │
│   └── settings (theme, accent color, spellcheck)       │
└────────────────────────────────────────────────────────┘
```

- **Local Storage Location**: Notes are stored in `%APPDATA%\com.localnote.desktop\localnote.db`.
- **Zero Remote Access**: No telemetry, analytics, authentication, or network APIs are used. The app is fully functional with no internet connection.
- **Strict Content Security Policy (CSP)**: `default-src 'self'` prevents external script injections or background data exfiltration.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
