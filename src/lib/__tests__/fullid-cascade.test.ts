import { describe, it, expect, vi } from "vitest";
import {
  batchCascadeFullIdChanges,
  computeFullIdPrefix,
  computeNewFullId,
  replaceFullIdPrefix,
  replaceFullIdInHtml,
} from "@/lib/fullid-cascade";

type FakeItem = {
  id: number;
  fullId: string;
  isDeleted: boolean;
  projectId: number;
  content: string | null;
};

type FakeHistory = { id: number; itemFullId: string };

type FakeRequest = {
  id: number;
  status: string;
  data: string;
  projectId: number;
};

function makeBatchTransaction(
  items: FakeItem[],
  histories: FakeHistory[] = [],
  requests: FakeRequest[] = []
) {
  const matches = (value: string, condition: unknown): boolean => {
    if (typeof condition === "string") return value === condition;
    if (
      typeof condition === "object" &&
      condition !== null &&
      "startsWith" in condition
    ) {
      return value.startsWith((condition as { startsWith: string }).startsWith);
    }
    return true;
  };

  const selected = <T extends Record<string, unknown>>(
    value: T,
    select?: Record<string, boolean>
  ): Partial<T> => {
    if (!select) return value;
    return Object.fromEntries(
      Object.keys(select)
        .filter((key) => select[key])
        .map((key) => [key, value[key]])
    ) as Partial<T>;
  };

  const matchesItemWhere = (item: FakeItem, where: Record<string, unknown>) => {
    if (where.fullId !== undefined && !matches(item.fullId, where.fullId)) {
      return false;
    }
    if (where.isDeleted !== undefined && item.isDeleted !== where.isDeleted) {
      return false;
    }
    const idFilter = where.id as { notIn?: number[] } | undefined;
    if (idFilter?.notIn?.includes(item.id)) return false;
    if (
      typeof where.projectId === "number" &&
      item.projectId !== where.projectId
    ) {
      return false;
    }
    const contentFilter = where.content as { contains?: string } | undefined;
    if (
      contentFilter?.contains !== undefined &&
      !item.content?.includes(contentFilter.contains)
    ) {
      return false;
    }
    return true;
  };

  const tx = {
    item: {
      findMany: vi.fn(async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) =>
        items
          .filter((item) => matchesItemWhere(item, where))
          .map((item) => selected(item, select))),
      update: vi.fn(async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<FakeItem>;
      }) => {
        const item = items.find((candidate) => candidate.id === where.id);
        if (!item) throw new Error(`Item ${where.id} not found`);
        Object.assign(item, data);
        return item;
      }),
      updateMany: vi.fn(async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<FakeItem>;
      }) => {
        const matching = items.filter((item) => matchesItemWhere(item, where));
        matching.forEach((item) => Object.assign(item, data));
        return { count: matching.length };
      }),
    },
    itemHistory: {
      updateMany: vi.fn(async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<FakeHistory>;
      }) => {
        const matching = histories.filter((history) =>
          matches(history.itemFullId, where.itemFullId)
        );
        matching.forEach((history) => Object.assign(history, data));
        return { count: matching.length };
      }),
      findMany: vi.fn(async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) =>
        histories
          .filter((history) => matches(history.itemFullId, where.itemFullId))
          .map((history) => selected(history, select))),
      update: vi.fn(async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<FakeHistory>;
      }) => {
        const history = histories.find((candidate) => candidate.id === where.id);
        if (!history) throw new Error(`History ${where.id} not found`);
        Object.assign(history, data);
        return history;
      }),
    },
    changeRequest: {
      findMany: vi.fn(async ({
        where,
        select,
      }: {
        where: { status: string; OR: unknown[] };
        select?: Record<string, boolean>;
      }) =>
        requests
          .filter(
            (request) =>
              request.status === where.status &&
              where.OR.length > 0 &&
              request.projectId === 7
          )
          .map((request) => selected(request, select))),
      update: vi.fn(async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<FakeRequest>;
      }) => {
        const request = requests.find((candidate) => candidate.id === where.id);
        if (!request) throw new Error(`Request ${where.id} not found`);
        Object.assign(request, data);
        return request;
      }),
    },
  };

  return tx;
}

// ---------------------------------------------------------------------------
// computeFullIdPrefix
// ---------------------------------------------------------------------------
describe("computeFullIdPrefix", () => {
  it("returns codePrefix + dash for root items", () => {
    expect(computeFullIdPrefix(null, "RMS")).toBe("RMS-");
  });

  it("returns parentFullId + dash for child items", () => {
    expect(computeFullIdPrefix("RMS-1", null)).toBe("RMS-1-");
  });

  it("prefers parentFullId when both are provided", () => {
    expect(computeFullIdPrefix("RMS-1", "RMS")).toBe("RMS-1-");
  });

  it("works with deeply nested parents", () => {
    expect(computeFullIdPrefix("RMS-1-2-3", null)).toBe("RMS-1-2-3-");
  });

  it("throws when both arguments are null", () => {
    expect(() => computeFullIdPrefix(null, null)).toThrow(
      "Either parentFullId or codePrefix must be provided"
    );
  });
});

// ---------------------------------------------------------------------------
// computeNewFullId
// ---------------------------------------------------------------------------
describe("computeNewFullId", () => {
  it("generates root fullId from codePrefix and seq", () => {
    expect(computeNewFullId("RMS", null, 3)).toBe("RMS-3");
  });

  it("generates child fullId from parentFullId and seq", () => {
    expect(computeNewFullId(null, "RMS-1", 2)).toBe("RMS-1-2");
  });

  it("generates deeply nested fullId", () => {
    expect(computeNewFullId(null, "RMS-1-2-3", 5)).toBe("RMS-1-2-3-5");
  });

  it("handles seq = 1", () => {
    expect(computeNewFullId("WQ", null, 1)).toBe("WQ-1");
  });

  it("handles large sequence numbers", () => {
    expect(computeNewFullId(null, "RMS-1", 100)).toBe("RMS-1-100");
  });
});

// ---------------------------------------------------------------------------
// replaceFullIdPrefix
// ---------------------------------------------------------------------------
describe("replaceFullIdPrefix", () => {
  it("replaces exact match", () => {
    expect(replaceFullIdPrefix("RMS-1-2", "RMS-1-2", "RMS-1-1")).toBe(
      "RMS-1-1"
    );
  });

  it("replaces descendant (child)", () => {
    expect(replaceFullIdPrefix("RMS-1-2-3", "RMS-1-2", "RMS-1-1")).toBe(
      "RMS-1-1-3"
    );
  });

  it("replaces deeply nested descendant", () => {
    expect(
      replaceFullIdPrefix("RMS-1-2-3-4-5", "RMS-1-2", "RMS-3")
    ).toBe("RMS-3-3-4-5");
  });

  it("does NOT match partial numeric overlap (RMS-1-20 vs RMS-1-2)", () => {
    expect(replaceFullIdPrefix("RMS-1-20", "RMS-1-2", "RMS-1-1")).toBe(
      "RMS-1-20"
    );
  });

  it("does NOT match partial numeric overlap on descendants", () => {
    expect(
      replaceFullIdPrefix("RMS-1-20-3", "RMS-1-2", "RMS-1-1")
    ).toBe("RMS-1-20-3");
  });

  it("returns original when no match at all", () => {
    expect(replaceFullIdPrefix("WQ-1-1", "RMS-1-2", "RMS-1-1")).toBe(
      "WQ-1-1"
    );
  });

  it("handles replacing root-level prefix", () => {
    expect(replaceFullIdPrefix("RMS-1", "RMS-1", "RMS-2")).toBe("RMS-2");
  });

  it("handles replacing root with descendant", () => {
    expect(replaceFullIdPrefix("RMS-1-3", "RMS-1", "RMS-2")).toBe("RMS-2-3");
  });

  it("does NOT match when oldPrefix is a substring but not at boundary", () => {
    // "RMS-1" should not match "RMS-10"
    expect(replaceFullIdPrefix("RMS-10", "RMS-1", "RMS-2")).toBe("RMS-10");
  });

  it("does NOT match RMS-10's children when looking for RMS-1", () => {
    expect(replaceFullIdPrefix("RMS-10-1", "RMS-1", "RMS-2")).toBe("RMS-10-1");
  });
});

// ---------------------------------------------------------------------------
// replaceFullIdInHtml
// ---------------------------------------------------------------------------
describe("replaceFullIdInHtml", () => {
  // --- data-item-id attribute ---
  it("replaces data-item-id exact match", () => {
    const html = '<a data-item-id="RMS-1-2" href="#">link</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a data-item-id="RMS-1-1" href="#">link</a>');
  });

  it("replaces data-item-id descendant", () => {
    const html = '<a data-item-id="RMS-1-2-3" href="#">link</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a data-item-id="RMS-1-1-3" href="#">link</a>');
  });

  it("does NOT replace partial data-item-id (RMS-1-20)", () => {
    const html = '<a data-item-id="RMS-1-20" href="#">link</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  // --- link text ---
  it("replaces link text exact match", () => {
    const html = '<a href="/item/1">RMS-1-2</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a href="/item/1">RMS-1-1</a>');
  });

  it("replaces link text descendant", () => {
    const html = '<a href="/item/1">RMS-1-2-3</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a href="/item/1">RMS-1-1-3</a>');
  });

  it("does NOT replace partial link text (RMS-1-20)", () => {
    const html = '<a href="/item/1">RMS-1-20</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  // --- combined ---
  it("replaces both attribute and link text in one pass", () => {
    const html =
      '<a data-item-id="RMS-1-2" href="/item/1">RMS-1-2</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe(
      '<a data-item-id="RMS-1-1" href="/item/1">RMS-1-1</a>'
    );
  });

  it("handles multiple occurrences", () => {
    const html =
      '<p>See <a data-item-id="RMS-1-2" href="#">RMS-1-2</a> and <a data-item-id="RMS-1-2-3" href="#">RMS-1-2-3</a></p>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe(
      '<p>See <a data-item-id="RMS-1-1" href="#">RMS-1-1</a> and <a data-item-id="RMS-1-1-3" href="#">RMS-1-1-3</a></p>'
    );
  });

  it("returns null when no changes are made", () => {
    const html = "<p>No item references here.</p>";
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  it("returns null for completely unrelated IDs", () => {
    const html = '<a data-item-id="WQ-5" href="#">WQ-5</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  it("handles empty HTML", () => {
    expect(replaceFullIdInHtml("", "RMS-1", "RMS-2")).toBeNull();
  });

  it("does not replace fullId outside of recognized patterns", () => {
    // Plain text mention should NOT be replaced (only data-item-id attrs and >...</a> text)
    const html = "<p>Item RMS-1-2 is important.</p>";
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  it("correctly handles mixed matching and non-matching IDs", () => {
    const html =
      '<a data-item-id="RMS-1-2" href="#">RMS-1-2</a> and <a data-item-id="RMS-1-20" href="#">RMS-1-20</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe(
      '<a data-item-id="RMS-1-1" href="#">RMS-1-1</a> and <a data-item-id="RMS-1-20" href="#">RMS-1-20</a>'
    );
  });

  it("handles deeply nested descendant in HTML", () => {
    const html = '<a data-item-id="RMS-1-2-3-4-5" href="#">RMS-1-2-3-4-5</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-3");
    expect(result).toBe(
      '<a data-item-id="RMS-3-3-4-5" href="#">RMS-3-3-4-5</a>'
    );
  });
});

// ---------------------------------------------------------------------------
// batchCascadeFullIdChanges
// ---------------------------------------------------------------------------
describe("batchCascadeFullIdChanges", () => {
  it("uses temporary fullIds for a bidirectional exchange", async () => {
    const items: FakeItem[] = [
      { id: 1, fullId: "RMS-1", isDeleted: false, projectId: 7, content: null },
      { id: 2, fullId: "RMS-2", isDeleted: false, projectId: 7, content: null },
    ];
    const tx = makeBatchTransaction(items);

    await batchCascadeFullIdChanges(
      tx as never,
      [
        { itemId: 1, oldFullId: "RMS-1", newFullId: "RMS-2" },
        { itemId: 2, oldFullId: "RMS-2", newFullId: "RMS-1" },
      ],
      7
    );

    const exactUpdates = tx.item.updateMany.mock.calls
      .map(([call]) => call.where.fullId)
      .filter((fullId) => typeof fullId === "string");
    expect(exactUpdates).toEqual([
      "RMS-1",
      "RMS-2",
      "__TEMP_RMS-2",
      "__TEMP_RMS-1",
    ]);
    expect(items.map((item) => item.fullId)).toEqual(["RMS-2", "RMS-1"]);
  });

  it("moves exact and descendant deleted conflicts out of the way", async () => {
    const items: FakeItem[] = [
      { id: 1, fullId: "RMS-1", isDeleted: false, projectId: 7, content: null },
      { id: 2, fullId: "RMS-2", isDeleted: true, projectId: 7, content: null },
      {
        id: 3,
        fullId: "RMS-2-1",
        isDeleted: true,
        projectId: 7,
        content: null,
      },
    ];
    const tx = makeBatchTransaction(items);

    await batchCascadeFullIdChanges(
      tx as never,
      [{ itemId: 1, oldFullId: "RMS-1", newFullId: "RMS-2" }],
      7
    );

    expect(items.find((item) => item.id === 2)?.fullId).toBe("__DELETED_RMS-2");
    expect(items.find((item) => item.id === 3)?.fullId).toBe(
      "__DELETED_RMS-2-1"
    );
  });

  it("updates HTML references and pending request JSON", async () => {
    const linkedHtml =
      '<a data-item-id="RMS-1-2-3" href="#">RMS-1-2-3</a>';
    const items: FakeItem[] = [
      {
        id: 1,
        fullId: "RMS-1-2",
        isDeleted: false,
        projectId: 7,
        content: null,
      },
      {
        id: 2,
        fullId: "RMS-9",
        isDeleted: false,
        projectId: 7,
        content: linkedHtml,
      },
    ];
    const request: FakeRequest = {
      id: 10,
      status: "PENDING",
      projectId: 7,
      data: JSON.stringify({ fullId: "RMS-1-2", content: linkedHtml }),
    };
    const tx = makeBatchTransaction(items, [], [request]);

    await batchCascadeFullIdChanges(
      tx as never,
      [{ itemId: 1, oldFullId: "RMS-1-2", newFullId: "RMS-3" }],
      7
    );

    const expectedHtml =
      '<a data-item-id="RMS-3-3" href="#">RMS-3-3</a>';
    expect(items.find((item) => item.id === 2)?.content).toBe(expectedHtml);
    expect(JSON.parse(request.data)).toEqual({
      fullId: "RMS-3",
      content: expectedHtml,
    });
  });
});
