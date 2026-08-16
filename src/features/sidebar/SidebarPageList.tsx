import type { Page } from "../pages/types";
import { Icon } from "../../components/Icon";

type SidebarPageListProps = {
  pages: Page[];
  activePageId: string | null;
  emptyMessage: string;
  onSelect: (id: string) => Promise<boolean>;
};

export function SidebarPageList({
  pages,
  activePageId,
  emptyMessage,
  onSelect,
}: SidebarPageListProps) {
  if (!pages.length) {
    return <p className="sidebar-section__empty">{emptyMessage}</p>;
  }

  return (
    <ul className="sidebar-page-list">
      {pages.map((page) => (
        <li key={page.id}>
          <button
            type="button"
            className="sidebar-link"
            aria-current={activePageId === page.id ? "page" : undefined}
            onClick={() => void onSelect(page.id)}
          >
            <Icon name="document" />
            <span className="sidebar-link__label">{page.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
