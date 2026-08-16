import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
  return (
    <header className="titlebar" aria-label="Application title bar">
      <div
        className="titlebar__drag-region"
        data-tauri-drag-region
        onDoubleClick={() => void getCurrentWindow().toggleMaximize()}
      >
        <img className="titlebar__mark" src="/app-icon.png" alt="" />
        <span className="titlebar__title">LocalNote</span>
      </div>
      <div className="titlebar__controls">
        <button type="button" aria-label="Minimize window" onClick={() => void getCurrentWindow().minimize()}>
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5.5h8" /></svg>
        </button>
        <button type="button" aria-label="Maximize or restore window" onClick={() => void getCurrentWindow().toggleMaximize()}>
          <svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" /></svg>
        </button>
        <button className="titlebar__close" type="button" aria-label="Close window" onClick={() => void getCurrentWindow().close()}>
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="m1.5 1.5 7 7m0-7-7 7" /></svg>
        </button>
      </div>
    </header>
  );
}
