import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFullIdChangesWithHistory, type FullIdChange } from "@/lib/fullid-mutation";
import { batchCascadeFullIdChanges } from "@/lib/fullid-cascade";

vi.mock("@/lib/fullid-cascade", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fullid-cascade")>(
    "@/lib/fullid-cascade"
  );
  return {
    ...actual,
    batchCascadeFullIdChanges: vi.fn(),
  };
});

type MockTransaction = {
  item: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  itemHistory: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTransactionMock(): MockTransaction {
  return {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    itemHistory: {
      create: vi.fn(),
    },
  };
}

describe("applyFullIdChangesWithHistory", () => {
  let tx: MockTransaction;

  beforeEach(() => {
    tx = createTransactionMock();
    vi.mocked(batchCascadeFullIdChanges).mockReset();
    vi.mocked(batchCascadeFullIdChanges).mockResolvedValue(undefined);
    tx.item.findMany.mockResolvedValue([]);
    tx.item.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      title: `項目 ${where.id}`,
    }));
    tx.itemHistory.create.mockResolvedValue({});
  });

  it("collects descendants before cascade and writes direct-first histories", async () => {
    const currentDescendants = [
      { id: 2, fullId: "RMS-1-1" },
      { id: 3, fullId: "RMS-1-1-1" },
    ];
    const directChange: FullIdChange = {
      itemId: 1,
      oldFullId: "RMS-1",
      newFullId: "RMS-2",
    };
    const events: string[] = [];

    tx.item.findMany.mockImplementation(async () => {
      events.push("collect");
      // Return copies so a later cascade-side query mutation cannot change
      // the oldFullId values captured for history.
      return currentDescendants.map((item) => ({ ...item }));
    });
    vi.mocked(batchCascadeFullIdChanges).mockImplementation(async () => {
      events.push("cascade");
      currentDescendants[0].fullId = "RMS-2-1";
      currentDescendants[1].fullId = "RMS-2-1-1";
    });

    await applyFullIdChangesWithHistory(tx as never, [directChange], {
      userId: "actor-1",
      projectId: 42,
      notePrefix: "重新排序",
    });

    expect(events).toEqual(["collect", "cascade"]);
    expect(batchCascadeFullIdChanges).toHaveBeenCalledWith(
      tx,
      [directChange],
      42
    );
    expect(tx.itemHistory.create).toHaveBeenCalledTimes(3);

    const historyData = tx.itemHistory.create.mock.calls.map(
      ([call]) => call.data
    );
    expect(historyData).toEqual([
      {
        itemId: 1,
        version: 0,
        changeType: "REORDER",
        snapshot: JSON.stringify({ oldFullId: "RMS-1", newFullId: "RMS-2" }),
        diff: null,
        submittedById: "actor-1",
        reviewedById: "actor-1",
        reviewStatus: "APPROVED",
        reviewNote: "重新排序：RMS-1 → RMS-2",
        itemFullId: "RMS-2",
        itemTitle: "項目 1",
        projectId: 42,
      },
      {
        itemId: 2,
        version: 0,
        changeType: "REORDER",
        snapshot: JSON.stringify({
          oldFullId: "RMS-1-1",
          newFullId: "RMS-2-1",
        }),
        diff: null,
        submittedById: "actor-1",
        reviewedById: "actor-1",
        reviewStatus: "APPROVED",
        reviewNote: "重新排序：RMS-1-1 → RMS-2-1",
        itemFullId: "RMS-2-1",
        itemTitle: "項目 2",
        projectId: 42,
      },
      {
        itemId: 3,
        version: 0,
        changeType: "REORDER",
        snapshot: JSON.stringify({
          oldFullId: "RMS-1-1-1",
          newFullId: "RMS-2-1-1",
        }),
        diff: null,
        submittedById: "actor-1",
        reviewedById: "actor-1",
        reviewStatus: "APPROVED",
        reviewNote: "重新排序：RMS-1-1-1 → RMS-2-1-1",
        itemFullId: "RMS-2-1-1",
        itemTitle: "項目 3",
        projectId: 42,
      },
    ]);
  });

  it("does not deduplicate or reorder duplicate direct changes", async () => {
    const changes: FullIdChange[] = [
      { itemId: 1, oldFullId: "RMS-1", newFullId: "RMS-2" },
      { itemId: 1, oldFullId: "RMS-1", newFullId: "RMS-2" },
    ];

    await applyFullIdChangesWithHistory(tx as never, changes, {
      userId: "actor-1",
      projectId: 42,
      notePrefix: "重新編號",
    });

    expect(batchCascadeFullIdChanges).toHaveBeenCalledWith(tx, changes, 42);
    expect(tx.itemHistory.create).toHaveBeenCalledTimes(2);
    expect(
      tx.itemHistory.create.mock.calls.map(([call]) => call.data.itemId)
    ).toEqual([1, 1]);
  });

  it("returns immediately for empty input", async () => {
    await applyFullIdChangesWithHistory(tx as never, [], {
      userId: "actor-1",
      projectId: 42,
      notePrefix: "重新排序",
    });

    expect(tx.item.findMany).not.toHaveBeenCalled();
    expect(batchCascadeFullIdChanges).not.toHaveBeenCalled();
    expect(tx.item.findUnique).not.toHaveBeenCalled();
    expect(tx.itemHistory.create).not.toHaveBeenCalled();
  });

  it("does not write history when cascading fails", async () => {
    const error = new Error("cascade failed");
    vi.mocked(batchCascadeFullIdChanges).mockRejectedValue(error);

    await expect(
      applyFullIdChangesWithHistory(
        tx as never,
        [{ itemId: 1, oldFullId: "RMS-1", newFullId: "RMS-2" }],
        { userId: "actor-1", projectId: 42, notePrefix: "重新排序" }
      )
    ).rejects.toBe(error);
    expect(tx.itemHistory.create).not.toHaveBeenCalled();
  });

  it("propagates history failures to the transaction caller", async () => {
    const error = new Error("history failed");
    tx.itemHistory.create.mockRejectedValue(error);

    await expect(
      applyFullIdChangesWithHistory(
        tx as never,
        [{ itemId: 1, oldFullId: "RMS-1", newFullId: "RMS-2" }],
        { userId: "actor-1", projectId: 42, notePrefix: "重新排序" }
      )
    ).rejects.toBe(error);
  });
});
