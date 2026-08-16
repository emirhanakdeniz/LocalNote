import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import { codeLanguages } from "./codeBlock";

const languageEntries = Object.entries(codeLanguages).map(([id, language]) => ({
  id,
  name: language.name,
  aliases: language.aliases ?? [],
}));

const languageMarks: Record<string, string> = {
  text: "TXT",
  java: "J",
  javascript: "JS",
  typescript: "TS",
  json: "{}",
  sql: "SQL",
  shellscript: "$_",
  powershell: "PS",
  python: "PY",
  html: "<>",
  css: "#",
};

type PickerPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type CodeLanguageControlProps = {
  select: HTMLSelectElement;
};

export function CodeLanguageControl({ select }: CodeLanguageControlProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeLanguage, setActiveLanguage] = useState(select.value || "text");
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<number | null>(null);
  const listboxId = useId();

  const filteredLanguages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return languageEntries;
    return languageEntries.filter((language) =>
      [language.name, language.id, ...language.aliases]
        .some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [query]);

  const updatePosition = () => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const viewportPadding = 8;
    const gap = 6;
    const width = Math.min(224, window.innerWidth - viewportPadding * 2);
    const availableBelow = window.innerHeight - trigger.bottom - gap - viewportPadding;
    const availableAbove = trigger.top - gap - viewportPadding;
    const placeBelow = availableBelow >= 180 || availableBelow >= availableAbove;
    const available = placeBelow ? availableBelow : availableAbove;
    const maxHeight = Math.min(292, Math.max(96, available));
    const left = Math.min(
      Math.max(viewportPadding, trigger.left),
      window.innerWidth - width - viewportPadding,
    );
    const top = placeBelow
      ? trigger.bottom + gap
      : Math.max(viewportPadding, trigger.top - gap - maxHeight);
    setPosition({ top, left, width, maxHeight });
  };

  useEffect(() => {
    select.hidden = true;
    select.tabIndex = -1;
    const updateActiveLanguage = () => setActiveLanguage(select.value || "text");
    select.addEventListener("change", updateActiveLanguage);
    return () => {
      select.hidden = false;
      select.tabIndex = 0;
      select.removeEventListener("change", updateActiveLanguage);
    };
  }, [select]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const update = () => updatePosition();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(Math.max(0, filteredLanguages.findIndex(({ id }) => id === activeLanguage)));
    if (position) searchRef.current?.focus();
  }, [activeLanguage, filteredLanguages, open, position]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listboxId}-${filteredLanguages[selectedIndex]?.id}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [filteredLanguages, listboxId, open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!pickerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        close(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  });

  const close = (restoreFocus = true) => {
    setOpen(false);
    setPosition(null);
    setQuery("");
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choose = (languageId: string) => {
    const previousTrigger = triggerRef.current;
    const previousSearch = searchRef.current;
    const triggerIndex = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".code-language-picker__trigger"),
    ).indexOf(previousTrigger!);
    select.value = languageId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setActiveLanguage(languageId);
    close(false);

    let attempts = 0;
    const restoreTriggerFocus = () => {
      const active = document.activeElement;
      const replacement = document.querySelectorAll<HTMLButtonElement>(
        ".code-language-picker__trigger",
      )[triggerIndex];
      if (
        replacement &&
        (active === document.body || active === previousTrigger || active === previousSearch)
      ) {
        replacement.focus();
      }
      attempts += 1;
      if (attempts < 3) requestAnimationFrame(restoreTriggerFocus);
    };
    requestAnimationFrame(restoreTriggerFocus);
  };

  const copyCode = async () => {
    const code = select.closest<HTMLElement>('[data-content-type="codeBlock"]')
      ?.querySelector("pre code")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const handleKeyboard = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" && filteredLanguages.length) {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % filteredLanguages.length);
    } else if (event.key === "ArrowUp" && filteredLanguages.length) {
      event.preventDefault();
      setSelectedIndex((current) => (current - 1 + filteredLanguages.length) % filteredLanguages.length);
    } else if (event.key === "Enter" && filteredLanguages[selectedIndex]) {
      event.preventDefault();
      choose(filteredLanguages[selectedIndex].id);
    }
  };

  const activeName = codeLanguages[activeLanguage]?.name ?? activeLanguage;
  const popoverStyle = position ? ({
    top: position.top,
    left: position.left,
    width: position.width,
    maxHeight: position.maxHeight,
  } satisfies CSSProperties) : undefined;

  const popover = open && position ? (
    <div
      ref={popoverRef}
      className="code-language-picker__popover"
      style={popoverStyle}
      onKeyDown={handleKeyboard}
    >
      <input
        ref={searchRef}
        type="search"
        spellCheck={false}
        aria-label="Search code languages"
        aria-controls={listboxId}
        aria-activedescendant={filteredLanguages[selectedIndex]
          ? `${listboxId}-${filteredLanguages[selectedIndex].id}`
          : undefined}
        placeholder="Search languages"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedIndex(0);
        }}
      />
      <div id={listboxId} className="code-language-picker__list" role="listbox" aria-label="Code languages">
        {filteredLanguages.length ? filteredLanguages.map((language, index) => (
          <button
            id={`${listboxId}-${language.id}`}
            key={language.id}
            type="button"
            role="option"
            aria-selected={language.id === activeLanguage}
            data-keyboard-selected={index === selectedIndex || undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(language.id)}
          >
            <span className="code-language-picker__option-label">
              <span className="code-language-picker__mark" aria-hidden="true">
                {languageMarks[language.id] ?? "·"}
              </span>
              <span>{language.name}</span>
            </span>
            {language.id === activeLanguage && <Icon name="check" />}
          </button>
        )) : <p>No languages found</p>}
      </div>
    </div>
  ) : null;

  return (
    <div className="code-block-toolbar">
      <div ref={pickerRef} className="code-language-picker" onKeyDown={handleKeyboard}>
        <button
          ref={triggerRef}
          type="button"
          className="code-language-picker__trigger"
          aria-label={`Code language: ${activeName}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => open ? close(false) : setOpen(true)}
        >
          <span className="code-language-picker__mark" aria-hidden="true">
            {languageMarks[activeLanguage] ?? "·"}
          </span>
          <span>{activeName}</span>
        </button>
        {popover && createPortal(popover, document.body)}
      </div>
      <div className="code-block-toolbar__actions">
        <button
          type="button"
          className={`code-block-toolbar__copy code-block-toolbar__copy--${copyState}`}
          aria-label={copyState === "copied" ? "Copied" : "Copy code"}
          onClick={() => void copyCode()}
        >
          <Icon name={copyState === "copied" ? "check" : "copy"} />
          <span>{copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}

export function CodeLanguagePickers({ root }: { root: HTMLElement | null }) {
  const [selects, setSelects] = useState<HTMLSelectElement[]>([]);

  useEffect(() => {
    if (!root) return;
    const scan = () => {
      const next = Array.from(root.querySelectorAll<HTMLSelectElement>(
        '.bn-block-content[data-content-type="codeBlock"] > div > select',
      ));
      setSelects((current) =>
        current.length === next.length && current.every((select, index) => select === next[index])
          ? current
          : next,
      );
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root]);

  return selects.map((select) =>
    createPortal(<CodeLanguageControl select={select} />, select.parentElement!, select.name || select.dataset.testid || String(selects.indexOf(select))),
  );
}
