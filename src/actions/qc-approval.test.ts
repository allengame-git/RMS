import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    qCDocumentApproval: { findUnique: vi.fn() },
    itemHistory: { findUnique: vi.fn() },
    changeRequest: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  getServerSession: vi.fn(),
  revalidatePath: vi.fn(),
  generateQCDocument: vi.fn(),
  createNotification: vi.fn(),
  getRequestChain: vi.fn(),
  completePMApproval: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/pdf-generator", () => ({ generateQCDocument: mocks.generateQCDocument }));
vi.mock("./notifications", () => ({ createNotification: mocks.createNotification }));
vi.mock("./history", () => ({ getRequestChain: mocks.getRequestChain }));
vi.mock("@/lib/qc-lifecycle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/qc-lifecycle")>("@/lib/qc-lifecycle");
  return { ...actual, completePMApproval: mocks.completePMApproval };
});

import { approveAsPM, batchApproveAsPM } from "@/actions/qc-approval";

function approvalFixture(id: number) {
  return {
    id,
    itemHistoryId: id + 100,
    status: "PENDING_PM",
    revisionCount: 4,
    itemHistory: {
      id: id + 100,
      changeRequestId: id + 200,
      submittedById: "editor",
      itemFullId: `RMS-${id}`,
      itemTitle: `項目${id}`,
    },
    qcApprovedBy: { username: "qc" },
    qcNote: "QC 通過",
    qcApprovedAt: new Date("2026-01-01"),
  };
}

describe("PM QC action orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: "pm", username: "pm-user" } });
    mocks.prisma.user.findUnique.mockResolvedValue({ isQC: false, isPM: true, username: "pm-user" });
    mocks.prisma.qCDocumentApproval.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
      Promise.resolve(approvalFixture(where.id))
    );
    mocks.prisma.changeRequest.findUnique.mockResolvedValue({ createdAt: new Date("2026-01-01") });
    mocks.prisma.itemHistory.findUnique.mockImplementation(({ where }: { where: { id: number } }) => Promise.resolve({
      id: where.id,
      itemFullId: `RMS-${where.id - 100}`,
      itemTitle: `項目${where.id - 100}`,
      projectId: 9,
      project: { codePrefix: "RMS", title: "專案" },
    }));
    mocks.getRequestChain.mockResolvedValue([]);
    mocks.completePMApproval.mockResolvedValue({
      approvalId: 1,
      itemHistoryId: 101,
      status: "COMPLETED",
      stage: "PM",
      sourceStage: "PM",
      submittedById: "editor",
      changeRequestId: 201,
      itemFullId: "RMS-1",
      itemTitle: "項目1",
    });
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({}));
  });

  it("does not finalize when PDF generation fails", async () => {
    const pdfError = new Error("PDF failed");
    mocks.generateQCDocument.mockRejectedValue(pdfError);

    const result = await approveAsPM(1, "核定");

    expect(result).toEqual({ error: "PM 核定失敗，請稍後再試" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.completePMApproval).not.toHaveBeenCalled();
  });

  it("generates PDF before entering the short finalization transaction", async () => {
    const events: string[] = [];
    mocks.generateQCDocument.mockImplementation(async () => {
      events.push("pdf");
      return "/iso/QC-RMS-101.pdf";
    });
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      events.push("tx");
      return callback({});
    });

    const result = await approveAsPM(1, "核定");

    expect(result).toEqual({ message: "PM approval completed - Document finalized" });
    expect(events).toEqual(["pdf", "tx"]);
    expect(mocks.completePMApproval).toHaveBeenCalledWith({}, {
      approvalId: 1,
      actorId: "pm",
      note: "核定",
      pdfPath: "/iso/QC-RMS-101.pdf",
      expectedRevisionCount: 4,
    });
  });

  it("keeps batch PM approval partially successful", async () => {
    mocks.generateQCDocument.mockImplementation(async (history: { id: number }) => {
      if (history.id === 101) throw new Error("first PDF failed");
      return "/iso/QC-RMS-102.pdf";
    });
    mocks.completePMApproval.mockImplementation(async (_tx: unknown, input: { approvalId: number }) => ({
      approvalId: input.approvalId,
      itemHistoryId: input.approvalId + 100,
      status: "COMPLETED",
      stage: "PM",
      sourceStage: "PM",
      submittedById: "editor",
      changeRequestId: input.approvalId + 200,
      itemFullId: `RMS-${input.approvalId}`,
      itemTitle: `項目${input.approvalId}`,
    }));

    const result = await batchApproveAsPM([1, 2], "核定");

    expect(result.successful).toEqual([2]);
    expect(result.failed).toEqual([{ id: 1, error: "處理失敗" }]);
  });
});
