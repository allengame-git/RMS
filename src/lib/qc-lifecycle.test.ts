import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completePMApproval,
  QCLifecycleError,
  recordApprovedHistory,
  reviewQCDocument,
  type ItemSnapshot,
} from "@/lib/qc-lifecycle";

type MockTransaction = {
  item: { update: ReturnType<typeof vi.fn> };
  itemHistory: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  qCDocumentApproval: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
  changeRequest: { update: ReturnType<typeof vi.fn> };
};

const snapshot: ItemSnapshot = {
  title: "項目",
  content: "內容",
  attachments: null,
  relatedItems: [],
  references: [],
};

function createTransactionMock(): MockTransaction {
  const tx: MockTransaction = {
    item: { update: vi.fn() },
    itemHistory: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    qCDocumentApproval: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    changeRequest: { update: vi.fn() },
  };

  tx.itemHistory.create.mockResolvedValue({ id: 10, version: 1 });
  tx.qCDocumentApproval.create.mockResolvedValue({ id: 20, itemHistoryId: 10 });
  tx.itemHistory.update.mockResolvedValue({ id: 10, version: 4 });
  tx.item.update.mockResolvedValue({});
  tx.qCDocumentApproval.updateMany.mockResolvedValue({ count: 1 });
  tx.qCDocumentApproval.findUnique.mockResolvedValue(null);
  tx.user.findUnique.mockResolvedValue({ isQC: false, isPM: false });
  tx.changeRequest.update.mockResolvedValue({});
  return tx;
}

function historyInput(changeType: "CREATE" | "UPDATE" | "DELETE" | "RESTORE") {
  return {
    item: {
      id: 1,
      currentVersion: 3,
      fullId: "RMS-1",
      title: "項目",
      projectId: 9,
    },
    snapshot,
    changeRequest: {
      id: 2,
      submittedById: "editor",
      submitReason: "理由",
      reviewNote: "同意",
      previousRequestId: null,
    },
    changeType,
    reviewerId: "reviewer",
  } as const;
}

describe("recordApprovedHistory", () => {
  let tx: MockTransaction;

  beforeEach(() => {
    tx = createTransactionMock();
    tx.itemHistory.findFirst.mockResolvedValue(null);
  });

  it.each([
    ["CREATE", 3],
    ["UPDATE", 4],
    ["DELETE", 4],
    ["RESTORE", 3],
  ] as const)("uses the %s version rule and updates Item.currentVersion", async (changeType, version) => {
    await recordApprovedHistory(tx as never, historyInput(changeType));

    expect(tx.itemHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version, changeType }) })
    );
    expect(tx.item.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { currentVersion: version },
    });
  });

  it("propagates QC initialization errors so the transaction can roll back", async () => {
    const error = new Error("qc create failed");
    tx.qCDocumentApproval.create.mockRejectedValue(error);

    await expect(recordApprovedHistory(tx as never, historyInput("CREATE"))).rejects.toBe(error);
    expect(tx.item.update).not.toHaveBeenCalled();
  });

  it("reuses only the direct rejected history and preserves unrelated fields", async () => {
    tx.itemHistory.findFirst.mockResolvedValue({
      id: 10,
      version: 4,
      changeType: "UPDATE",
      diff: '{"title":{"old":"舊","new":"更舊"}}',
      reviewStatus: "APPROVED",
      itemFullId: "RMS-1",
      itemTitle: "舊標題",
      isoDocPath: "/iso/old.pdf",
      qcApproval: {
        id: 20,
        status: "REJECTED",
        revisionCount: 2,
        qcApprovedById: "qc-old",
        qcApprovedAt: new Date("2026-01-01"),
        qcNote: "qc-old-note",
        pmApprovedById: "pm-old",
        pmApprovedAt: new Date("2026-01-02"),
        pmNote: "pm-old-note",
      },
    });

    const result = await recordApprovedHistory(tx as never, {
      ...historyInput("UPDATE"),
      changeRequest: {
        ...historyInput("UPDATE").changeRequest,
        id: 3,
        previousRequestId: 2,
      },
    });

    expect(result.reused).toBe(true);
    expect(tx.itemHistory.create).not.toHaveBeenCalled();
    expect(tx.item.update).not.toHaveBeenCalled();
    expect(tx.qCDocumentApproval.updateMany).toHaveBeenCalledWith({
      where: { id: 20, status: "REJECTED", revisionCount: 2 },
      data: expect.objectContaining({
        status: "PENDING_QC",
        revisionCount: { increment: 1 },
        qcApprovedById: null,
        qcApprovedAt: null,
        qcNote: null,
        pmApprovedById: null,
        pmApprovedAt: null,
        pmNote: null,
      }),
    });
    expect(result.approval).toEqual(expect.objectContaining({
      status: "PENDING_QC",
      revisionCount: 3,
      qcApprovedById: null,
      qcApprovedAt: null,
      qcNote: null,
      pmApprovedById: null,
      pmApprovedAt: null,
      pmNote: null,
    }));
    expect(tx.itemHistory.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        snapshot: JSON.stringify(snapshot),
        changeRequestId: 3,
        submittedById: "editor",
        reviewedById: "reviewer",
        reviewNote: "同意",
        submitReason: "理由",
      },
    });
  });

  it("falls back to a normal UPDATE when the direct history is not rejected", async () => {
    tx.itemHistory.findFirst.mockResolvedValue({
      id: 10,
      changeType: "UPDATE",
      qcApproval: { id: 20, status: "PENDING_QC", revisionCount: 0 },
    });

    await recordApprovedHistory(tx as never, {
      ...historyInput("UPDATE"),
      changeRequest: { ...historyInput("UPDATE").changeRequest, previousRequestId: 2 },
    });

    expect(tx.itemHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.qCDocumentApproval.create).toHaveBeenCalledTimes(1);
    expect(tx.item.update).toHaveBeenCalledTimes(1);
  });
});

function approvalFixture(status: string, submittedById = "editor", revisionCount = 0) {
  return {
    id: 20,
    itemHistoryId: 10,
    status,
    revisionCount,
    itemHistory: {
      id: 10,
      itemFullId: "RMS-1",
      itemTitle: "項目",
      submittedById,
      changeRequestId: 2,
    },
  };
}

describe("reviewQCDocument", () => {
  let tx: MockTransaction;

  beforeEach(() => {
    tx = createTransactionMock();
    tx.qCDocumentApproval.findUnique.mockResolvedValue(approvalFixture("PENDING_QC"));
  });

  it("allows QC approval, including the revision CAS", async () => {
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: false });

    const result = await reviewQCDocument(tx as never, {
      approvalId: 20,
      actorId: "qc",
      decision: "APPROVE",
      note: "通過",
    });

    expect(result.sourceStage).toBe("QC");
    expect(result.status).toBe("PENDING_PM");
    expect(tx.qCDocumentApproval.updateMany).toHaveBeenCalledWith({
      where: { id: 20, status: "PENDING_QC", revisionCount: 0 },
      data: expect.objectContaining({ status: "PENDING_PM", qcApprovedById: "qc" }),
    });
  });

  it("defaults an empty QC approval note to 同意", async () => {
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: false });

    await reviewQCDocument(tx as never, {
      approvalId: 20,
      actorId: "qc",
      decision: "APPROVE",
      note: "",
    });

    expect(tx.qCDocumentApproval.updateMany).toHaveBeenCalledWith({
      where: { id: 20, status: "PENDING_QC", revisionCount: 0 },
      data: expect.objectContaining({ qcNote: "同意" }),
    });
  });

  it("rejects with the real stage for a dual-qualified actor and updates ChangeRequest in the same tx", async () => {
    tx.qCDocumentApproval.findUnique.mockResolvedValue(approvalFixture("PENDING_PM"));
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: true });

    const result = await reviewQCDocument(tx as never, {
      approvalId: 20,
      actorId: "dual",
      decision: "REJECT",
      note: "請修正",
    });

    expect(result.stage).toBe("PM");
    expect(result.sourceStage).toBe("PM");
    expect(tx.changeRequest.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { status: "REJECTED", reviewedById: "dual", reviewNote: "請修正" },
    });
  });

  it("reports QC as the source stage when a dual-qualified actor rejects at QC", async () => {
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: true });

    const result = await reviewQCDocument(tx as never, {
      approvalId: 20,
      actorId: "dual",
      decision: "REJECT",
      note: "QC 退回",
    });

    expect(result.stage).toBe("QC");
    expect(result.sourceStage).toBe("QC");
  });

  it.each([
    "COMPLETED",
    "REJECTED",
    "REVISION_REQUIRED",
    "UNKNOWN",
  ])("rejects a non-pending state (%s) without writes", async (status) => {
    tx.qCDocumentApproval.findUnique.mockResolvedValue(approvalFixture(status));
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: true });

    await expect(
      reviewQCDocument(tx as never, {
        approvalId: 20,
        actorId: "dual",
        decision: "REJECT",
        note: "退回",
      })
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(tx.qCDocumentApproval.updateMany).not.toHaveBeenCalled();
    expect(tx.changeRequest.update).not.toHaveBeenCalled();
  });

  it.each([
    ["PENDING_QC", { isQC: false, isPM: true }],
    ["PENDING_PM", { isQC: true, isPM: false }],
  ] as const)("requires the database qualification for %s rejection", async (status, qualifications) => {
    tx.qCDocumentApproval.findUnique.mockResolvedValue(approvalFixture(status));
    tx.user.findUnique.mockResolvedValue(qualifications);

    await expect(
      reviewQCDocument(tx as never, {
        approvalId: 20,
        actorId: "wrong-stage-user",
        decision: "REJECT",
        note: "退回",
      })
    ).rejects.toMatchObject({ code: "QUALIFICATION_REQUIRED" });
    expect(tx.qCDocumentApproval.updateMany).not.toHaveBeenCalled();
    expect(tx.changeRequest.update).not.toHaveBeenCalled();
  });

  it("forbids self approval but retains the existing self-rejection behavior", async () => {
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: false });
    tx.qCDocumentApproval.findUnique.mockResolvedValue(approvalFixture("PENDING_QC", "same-user"));

    await expect(
      reviewQCDocument(tx as never, {
        approvalId: 20,
        actorId: "same-user",
        decision: "APPROVE",
      })
    ).rejects.toMatchObject({ code: "SELF_APPROVAL" });
    expect(tx.qCDocumentApproval.updateMany).not.toHaveBeenCalled();

    const result = await reviewQCDocument(tx as never, {
      approvalId: 20,
      actorId: "same-user",
      decision: "REJECT",
      note: "退回",
    });
    expect(result.status).toBe("REJECTED");
  });

  it("does not update the ChangeRequest after a stale conditional status update", async () => {
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: false });
    tx.qCDocumentApproval.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      reviewQCDocument(tx as never, {
        approvalId: 20,
        actorId: "qc",
        decision: "REJECT",
        note: "退回",
      })
    ).rejects.toMatchObject({ code: "STALE_OPERATION" });
    expect(tx.changeRequest.update).not.toHaveBeenCalled();
  });
});

describe("completePMApproval", () => {
  let tx: MockTransaction;

  beforeEach(() => {
    tx = createTransactionMock();
    tx.qCDocumentApproval.findUnique.mockResolvedValue(approvalFixture("PENDING_PM", "editor", 3));
    tx.user.findUnique.mockResolvedValue({ isQC: true, isPM: true });
  });

  it("requires the expected revision and writes status plus PDF in one tx", async () => {
    const result = await completePMApproval(tx as never, {
      approvalId: 20,
      actorId: "pm",
      note: "核定",
      pdfPath: "/iso/QC-RMS-10.pdf",
      expectedRevisionCount: 3,
    });

    expect(result.status).toBe("COMPLETED");
    expect(tx.qCDocumentApproval.updateMany).toHaveBeenCalledWith({
      where: { id: 20, status: "PENDING_PM", revisionCount: 3 },
      data: expect.objectContaining({ status: "COMPLETED", pmApprovedById: "pm" }),
    });
    expect(tx.itemHistory.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { isoDocPath: "/iso/QC-RMS-10.pdf" },
    });
  });

  it("forbids PM self approval", async () => {
    tx.qCDocumentApproval.findUnique.mockResolvedValue(approvalFixture("PENDING_PM", "pm", 3));

    await expect(
      completePMApproval(tx as never, {
        approvalId: 20,
        actorId: "pm",
        pdfPath: "/iso/QC-RMS-10.pdf",
        expectedRevisionCount: 3,
      })
    ).rejects.toMatchObject({ code: "SELF_APPROVAL" });
    expect(tx.qCDocumentApproval.updateMany).not.toHaveBeenCalled();
    expect(tx.itemHistory.update).not.toHaveBeenCalled();
  });

  it("rejects a revision mismatch before any write", async () => {
    await expect(
      completePMApproval(tx as never, {
        approvalId: 20,
        actorId: "pm",
        pdfPath: "/iso/QC-RMS-10.pdf",
        expectedRevisionCount: 2,
      })
    ).rejects.toMatchObject({ code: "REVISION_MISMATCH" });
    expect(tx.qCDocumentApproval.updateMany).not.toHaveBeenCalled();
    expect(tx.itemHistory.update).not.toHaveBeenCalled();
  });

  it("does not write the history when the final status CAS loses the race", async () => {
    tx.qCDocumentApproval.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      completePMApproval(tx as never, {
        approvalId: 20,
        actorId: "pm",
        pdfPath: "/iso/QC-RMS-10.pdf",
        expectedRevisionCount: 3,
      })
    ).rejects.toMatchObject({ code: "STALE_OPERATION" });
    expect(tx.itemHistory.update).not.toHaveBeenCalled();
  });
});
