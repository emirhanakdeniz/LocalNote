import { Icon } from "../../components/Icon";

type SearchBoxProps = {
  onClick: () => void;
  className?: string;
};

export function SearchBox({ onClick, className = "" }: SearchBoxProps) {
  return (
    <button
      type="button"
      className={`sidebar-search-box ${className}`.trim()}
      aria-label="Search notes"
      title="Search notes (Ctrl+P)"
      onClick={onClick}
    >
      <div className="sidebar-search-box__left">
        <Icon name="search" className="sidebar-search-box__icon" />
        <span className="sidebar-search-box__placeholder">Search</span>
      </div>
      <span className="sidebar-shortcut-badge" aria-hidden="true">
        Ctrl P
      </span>
    </button>
  );
}
