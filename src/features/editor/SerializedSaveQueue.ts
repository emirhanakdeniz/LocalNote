import type { DocumentRecord } from "./types";

type SaveOperation = (
  pageId: string,
  contentJson: string,
) => Promise<DocumentRecord>;

export class SerializedSaveQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly save: SaveOperation) {}

  enqueue(pageId: string, contentJson: string): Promise<DocumentRecord> {
    const operation = this.tail.then(() => this.save(pageId, contentJson));
    this.tail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async idle(): Promise<void> {
    await this.tail;
  }
}
