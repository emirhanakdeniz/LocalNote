import type { PartialBlock } from "@blocknote/core";

export class MalformedDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedDocumentError";
  }
}

export function parseDocument(contentJson: string | null): PartialBlock[] {
  if (contentJson === null) return [];

  let value: unknown;
  try {
    value = JSON.parse(contentJson);
  } catch {
    throw new MalformedDocumentError(
      "This note contains malformed stored JSON. Its original data has been preserved and autosave is disabled.",
    );
  }

  if (
    !Array.isArray(value) ||
    value.some(
      (block) =>
        typeof block !== "object" ||
        block === null ||
        typeof (block as Record<string, unknown>).type !== "string",
    )
  ) {
    throw new MalformedDocumentError(
      "This note is not a recognizable BlockNote document. Its original data has been preserved and autosave is disabled.",
    );
  }

  return value as PartialBlock[];
}
