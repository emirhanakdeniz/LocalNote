import { Icon } from "../../components/Icon";

type NewNoteButtonProps = {
  onClick: () => void;
  className?: string;
};

export function NewNoteButton({ onClick, className = "" }: NewNoteButtonProps) {
  return (
    <button
      type="button"
      className={`sidebar-new-note-btn ${className}`.trim()}
      aria-label="New page"
      title="New page (Ctrl+N)"
      onClick={onClick}
    >
      <div className="sidebar-new-note-btn__left">
        <Icon name="plus" className="sidebar-new-note-btn__icon" />
        <span className="sidebar-new-note-btn__label">New Note</span>
      </div>
      <span className="sidebar-shortcut-badge" aria-hidden="true">
        Ctrl N
      </span>
    </button>
  );
}
