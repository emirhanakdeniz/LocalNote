import type { ReactNode } from "react";

type SidebarSectionProps = {
  title: string;
  children: ReactNode;
};

export function SidebarSection({ title, children }: SidebarSectionProps) {
  const headingId = `sidebar-${title.toLowerCase()}-heading`;

  return (
    <section className="sidebar-section" aria-labelledby={headingId}>
      <h2 className="sidebar-section__heading" id={headingId}>
        {title}
      </h2>
      <div className="sidebar-section__content">{children}</div>
    </section>
  );
}
