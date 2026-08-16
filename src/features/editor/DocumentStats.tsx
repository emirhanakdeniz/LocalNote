import { useMemo } from "react";
import type { PartialBlock } from "@blocknote/core";

type DocumentStatsProps = {
  blocks: PartialBlock[];
  className?: string;
};

function extractTextFromBlocks(blocks: PartialBlock[]): string {
  let text = "";

  const extract = (items: PartialBlock[]) => {
    for (const item of items) {
      if (typeof item.content === "string") {
        text += " " + item.content;
      } else if (Array.isArray(item.content)) {
        for (const sub of item.content) {
          if (typeof sub === "string") {
            text += " " + sub;
          } else if (typeof sub === "object" && sub !== null && "text" in sub) {
            text += " " + ((sub as { text?: string }).text ?? "");
          }
        }
      }
      if (item.children && Array.isArray(item.children)) {
        extract(item.children as PartialBlock[]);
      }
    }
  };

  extract(blocks);
  return text.trim();
}

export function DocumentStats({ blocks, className = "" }: DocumentStatsProps) {
  const { words, chars } = useMemo(() => {
    const fullText = extractTextFromBlocks(blocks);
    const charCount = fullText.length;
    const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
    return { words: wordCount, chars: charCount };
  }, [blocks]);

  if (words === 0 && chars === 0) return null;

  return (
    <div className={`document-stats ${className}`.trim()} aria-label="Document statistics">
      <span>{words} {words === 1 ? "word" : "words"}</span>
      <span className="document-stats__separator">·</span>
      <span>{chars} {chars === 1 ? "char" : "chars"}</span>
    </div>
  );
}
