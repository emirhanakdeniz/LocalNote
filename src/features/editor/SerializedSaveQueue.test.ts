import { describe, expect, it, vi } from "vitest";
import { SerializedSaveQueue } from "./SerializedSaveQueue";
import type { DocumentRecord } from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("SerializedSaveQueue", () => {
  it("never starts a newer save before the older save settles", async () => {
    const first = deferred<DocumentRecord>();
    const second = deferred<DocumentRecord>();
    const persisted: string[] = [];
    const save = vi
      .fn<(pageId: string, contentJson: string) => Promise<DocumentRecord>>()
      .mockImplementationOnce(async (_pageId, contentJson) => {
        const result = await first.promise;
        persisted.push(contentJson);
        return result;
      })
      .mockImplementationOnce(async (_pageId, contentJson) => {
        const result = await second.promise;
        persisted.push(contentJson);
        return result;
      });
    const queue = new SerializedSaveQueue(save);

    const older = queue.enqueue("page-a", "A");
    const newer = queue.enqueue("page-a", "C");
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve({ pageId: "page-a", contentJson: "A", updatedAt: "first" });
    await older;
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));

    second.resolve({ pageId: "page-a", contentJson: "C", updatedAt: "second" });
    await newer;
    expect(persisted).toEqual(["A", "C"]);
    expect(persisted.at(-1)).toBe("C");
  });
});
