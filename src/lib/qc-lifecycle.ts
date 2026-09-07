import type { Item, ItemHistory, Prisma, QCDocumentApproval } from "@prisma/client";

export type ItemChangeType = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";

export interface ItemSnapshot {
  title: string;
  content: string | null;
  attachments: string | null;
  relatedItems: {
    id: number;
    fullId: string;
    title?: string;
    description?: string | null;
  }[];
  references?: {
    fileId: number;
    dataCode: string;
    dataName: string;
    dataYear: number | null;
    author: string | null;
    citation?: string | null;
  }[];
}

export interface ApprovedHistoryChangeRequest {
  id: number;
  submittedById: string | null;
  submitReason?: string | null;
  reviewNote?: string | null;
  createdAt?: Date;
  previousRequestId?: number | null;
}

export interface RecordApprovedHistoryInput {
  item: Pick<Item, "id" | "currentVersion" | "fullId" | "title" | "projectId">;
  /** `snapshot` is the preferred name; `snapshotData` keeps the old action vocabulary usable. */
  snapshot?: ItemSnapshot;
  snapshotData?: ItemSnapshot;
  changeRequest?: ApprovedHistoryChangeRequest;
  request?: ApprovedHistoryChangeRequest;
  changeType: ItemChangeType;
  reviewerId: string;
  oldSnapshot?: ItemSnapshot;
}

export interface RecordApprovedHistoryResult {
  history: ItemHistory;
  approval: QCDocumentApproval;
  reused: boolean;
}

export type QCLifecycleErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "QUALIFICATION_REQUIRED"
  | "SELF_APPROVAL"
  | "INVALID_STATE"
  | "STALE_OPERATION"
  | "REVISION_MISMATCH";

/** Known workflow failures are safe for an action to expose to a user. */
export class QCLifecycleError extends Error {
  readonly code: QCLifecycleErrorCode;
  readonly userMessage: string;

  constructor(code: QCLifecycleErrorCode, userMessage: string) {
    super(userMessage);
    this.name = "QCLifecycleError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

function lifecycleError(code: QCLifecycleErrorCode, userMessage: string): QCLifecycleError {
  return new QCLifecycleError(code, userMessage);
}

/** Compute the audit diff for the fields represented by an item snapshot. */
export function computeDiff(oldData: ItemSnapshot, newData: ItemSnapshot) {
  const diff: Record<string, { old: unknown; new: unknown }> = {};

  for (const key of ["title", "content", "attachments"] as const) {
    const oldValue = oldData[key];
    const newValue = newData[key];

    if (oldValue !== newValue) {
      diff[key] = { old: oldValue, new: newValue };
    }
  }

  const oldRelations = [...oldData.relatedItems].sort((a, b) => a.id - b.id);
  const newRelations = [...newData.relatedItems].sort((a, b) => a.id - b.id);
  if (JSON.stringify(oldRelations) !== JSON.stringify(newRelations)) {
    diff.relatedItems = { old: oldRelations, new: newRelations };
  }

  const oldReferences = [...(oldData.references ?? [])].sort((a, b) => a.fileId - b.fileId);
  const newReferences = [...(newData.references ?? [])].sort((a, b) => a.fileId - b.fileId);
  if (JSON.stringify(oldReferences) !== JSON.stringify(newReferences)) {
    diff.references = { old: oldReferences, new: newReferences };
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

function getHistoryInput(input: RecordApprovedHistoryInput): {
  snapshot: ItemSnapshot;
  changeRequest: ApprovedHistoryChangeRequest;
} {
  const snapshot = input.snapshot ?? input.snapshotData;
  const changeRequest = input.changeRequest ?? input.request;

  if (!snapshot || !changeRequest) {
    throw lifecycleError("INVALID_INPUT", "歷史紀錄資料不完整");
  }

  return { snapshot, changeRequest };
}

export type ReviewDecision = "APPROVE" | "REJECT";
export type ReviewStage = "QC" | "PM";

export interface ReviewQCDocumentInput {
  approvalId: number;
  actorId: string;
  decision: ReviewDecision | string;
  note?: string | null;
}

export interface QCDocumentNotificationData {
  userId: string;
  itemHistoryId: number;
  qcApprovalId: number;
  changeRequestId: number | null;
  itemFullId: string;
  itemTitle: string;
}

export interface ReviewQCDocumentResult {
  approvalId: number;
  itemHistoryId: number;
  status: string;
  /** The stage that actually owned the reviewed state, not the actor's qualifications. */
  stage: ReviewStage;
  sourceStage: ReviewStage;
  submittedById: string | null;
  changeRequestId: number | null;
  itemFullId: string;
  itemTitle: string;
  notification?: QCDocumentNotificationData;
}

export interface CompletePMApprovalInput {
  approvalId: number;
  actorId: string;
  note?: string | null;
  pdfPath: string;
  expectedRevisionCount: number;
}

export interface CompletePMApprovalResult extends ReviewQCDocumentResult {
  status: "COMPLETED";
  pdfPath: string;
}

type ApprovalForWorkflow = {
  id: number;
  itemHistoryId: number;
  status: string;
  revisionCount: number;
  itemHistory: {
    id: number;
    itemFullId: string;
    itemTitle: string;
    submittedById: string | null;
    changeRequestId: number | null;
  };
};

type ActorQualification = { isQC: boolean; isPM: boolean };

function notificationFor(approval: ApprovalForWorkflow): QCDocumentNotificationData | undefined {
  const { itemHistory } = approval;
  if (!itemHistory.submittedById) return undefined;

  return {
    userId: itemHistory.submittedById,
    itemHistoryId: itemHistory.id,
    qcApprovalId: approval.id,
    changeRequestId: itemHistory.changeRequestId,
    itemFullId: itemHistory.itemFullId,
    itemTitle: itemHistory.itemTitle,
  };
}

async function readApproval(
  tx: Prisma.TransactionClient,
  approvalId: number
): Promise<ApprovalForWorkflow> {
  const approval = await tx.qCDocumentApproval.findUnique({
    where: { id: approvalId },
    select: {
      id: true,
      itemHistoryId: true,
      status: true,
      revisionCount: true,
      itemHistory: {
        select: {
          id: true,
          itemFullId: true,
          itemTitle: true,
          submittedById: true,
          changeRequestId: true,
        },
      },
    },
  });

  if (!approval) {
    throw lifecycleError("NOT_FOUND", "找不到品質文件審查記錄");
  }

  return approval;
}

async function readActorQualification(
  tx: Prisma.TransactionClient,
  actorId: string
): Promise<ActorQualification> {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { isQC: true, isPM: true },
  });

  if (!actor) {
    throw lifecycleError("QUALIFICATION_REQUIRED", "找不到目前使用者資格");
  }

  return actor;
}

function assertConditionalUpdate(count: number, message: string): void {
  if (count !== 1) {
    throw lifecycleError("STALE_OPERATION", message);
  }
}

/**
 * Write an approved item history and start its QC workflow in the supplied transaction.
 * The caller owns the transaction; every write, including QC initialization, is allowed
 * to fail so the outer transaction can roll back the complete approval.
 */
export async function recordApprovedHistory(
  tx: Prisma.TransactionClient,
  input: RecordApprovedHistoryInput
): Promise<RecordApprovedHistoryResult> {
  const { snapshot, changeRequest } = getHistoryInput(input);

  if (input.changeType === "UPDATE" && changeRequest.previousRequestId != null) {
    const previousHistory = await tx.itemHistory.findFirst({
      where: { changeRequestId: changeRequest.previousRequestId },
      include: { qcApproval: true },
    });

    // Only the direct previous request and a rejected QC record qualify. Do not walk
    // the request chain, and do not reuse a history from another change type.
    if (previousHistory?.qcApproval?.status === "REJECTED") {
      const approvalReset = await tx.qCDocumentApproval.updateMany({
        where: {
          id: previousHistory.qcApproval.id,
          status: "REJECTED",
          revisionCount: previousHistory.qcApproval.revisionCount,
        },
        data: {
          status: "PENDING_QC",
          qcApprovedById: null,
          qcApprovedAt: null,
          qcNote: null,
          pmApprovedById: null,
          pmApprovedAt: null,
          pmNote: null,
          revisionCount: { increment: 1 },
        },
      });
      assertConditionalUpdate(
        approvalReset.count,
        "此品質文件已被其他操作更新，請重新整理後再試"
      );

      const history = await tx.itemHistory.update({
        where: { id: previousHistory.id },
        data: {
          snapshot: JSON.stringify(snapshot),
          changeRequestId: changeRequest.id,
          submittedById: changeRequest.submittedById,
          reviewedById: input.reviewerId,
          reviewNote: changeRequest.reviewNote || null,
          submitReason: changeRequest.submitReason || null,
        },
      });

      return {
        history,
        approval: {
          ...previousHistory.qcApproval,
          status: "PENDING_QC",
          qcApprovedById: null,
          qcApprovedAt: null,
          qcNote: null,
          pmApprovedById: null,
          pmApprovedAt: null,
          pmNote: null,
          revisionCount: previousHistory.qcApproval.revisionCount + 1,
        },
        reused: true,
      };
    }
  }

  const version =
    input.changeType === "UPDATE" || input.changeType === "DELETE"
      ? input.item.currentVersion + 1
      : input.item.currentVersion;
  const diff =
    input.changeType === "UPDATE" && input.oldSnapshot
      ? computeDiff(input.oldSnapshot, snapshot)
      : null;

  const history = await tx.itemHistory.create({
    data: {
      itemId: input.item.id,
      version,
      changeType: input.changeType,
      snapshot: JSON.stringify(snapshot),
      diff: diff ? JSON.stringify(diff) : null,
      submittedById: changeRequest.submittedById,
      reviewedById: input.reviewerId,
      reviewStatus: "APPROVED",
      reviewNote: changeRequest.reviewNote || null,
      submitReason: changeRequest.submitReason || null,
      changeRequestId: changeRequest.id,
      itemFullId: input.item.fullId,
      itemTitle: input.item.title,
      projectId: input.item.projectId,
    },
  });

  // Do not swallow this error: the caller's transaction must roll back the history
  // and any item mutation if QC initialization fails.
  const approval = await tx.qCDocumentApproval.create({
    data: {
      itemHistoryId: history.id,
      status: "PENDING_QC",
    },
  });

  await tx.item.update({
    where: { id: input.item.id },
    data: { currentVersion: version },
  });

  return { history, approval, reused: false };
}

/**
 * Apply one QC decision. PM approval is deliberately completed by
 * `completePMApproval` because it requires a PDF generated outside the transaction.
 */
export async function reviewQCDocument(
  tx: Prisma.TransactionClient,
  input: ReviewQCDocumentInput
): Promise<ReviewQCDocumentResult> {
  const approval = await readApproval(tx, input.approvalId);
  const actor = await readActorQualification(tx, input.actorId);
  const decision = input.decision.toUpperCase();

  if (decision !== "APPROVE" && decision !== "REJECT") {
    throw lifecycleError("INVALID_INPUT", "不支援的品質文件審查動作");
  }

  let stage: ReviewStage;
  if (approval.status === "PENDING_QC") {
    stage = "QC";
    if (!actor.isQC) {
      throw lifecycleError("QUALIFICATION_REQUIRED", "只有 QC 資格者可以審核此階段");
    }
  } else if (approval.status === "PENDING_PM") {
    stage = "PM";
    if (decision === "APPROVE") {
      throw lifecycleError("INVALID_STATE", "PM 核定需先完成品質文件生成");
    }
    if (!actor.isPM) {
      throw lifecycleError("QUALIFICATION_REQUIRED", "只有 PM 資格者可以退回此階段");
    }
  } else {
    throw lifecycleError("INVALID_STATE", "此品質文件目前不可審核");
  }

  // Existing rejection behaviour intentionally permits a submitter to reject their
  // own document. The self-approval prohibition applies only to approvals.
  if (decision === "APPROVE" && approval.itemHistory.submittedById === input.actorId) {
    throw lifecycleError("SELF_APPROVAL", "您不能審核自己提交的文件");
  }

  const note = decision === "APPROVE" ? input.note || "同意" : input.note ?? null;
  const nextStatus = decision === "APPROVE" ? "PENDING_PM" : "REJECTED";
  const data =
    stage === "QC"
      ? {
          status: nextStatus,
          qcApprovedById: input.actorId,
          qcApprovedAt: new Date(),
          qcNote: note,
        }
      : {
          status: nextStatus,
          pmApprovedById: input.actorId,
          pmApprovedAt: new Date(),
          pmNote: note,
        };

  const updated = await tx.qCDocumentApproval.updateMany({
    where: {
      id: input.approvalId,
      status: approval.status,
      revisionCount: approval.revisionCount,
    },
    data,
  });
  assertConditionalUpdate(updated.count, "此品質文件已被其他操作更新，請重新整理後再試");

  if (decision === "REJECT" && approval.itemHistory.changeRequestId != null) {
    await tx.changeRequest.update({
      where: { id: approval.itemHistory.changeRequestId },
      data: {
        status: "REJECTED",
        reviewedById: input.actorId,
        reviewNote: input.note ?? null,
      },
    });
  }

  return {
    approvalId: approval.id,
    itemHistoryId: approval.itemHistoryId,
    status: nextStatus,
    stage,
    sourceStage: stage,
    submittedById: approval.itemHistory.submittedById,
    changeRequestId: approval.itemHistory.changeRequestId,
    itemFullId: approval.itemHistory.itemFullId,
    itemTitle: approval.itemHistory.itemTitle,
    notification: decision === "REJECT" ? notificationFor(approval) : undefined,
  };
}

/** Finalize PM approval after PDF generation, guarded by status and revision. */
export async function completePMApproval(
  tx: Prisma.TransactionClient,
  input: CompletePMApprovalInput
): Promise<CompletePMApprovalResult> {
  const approval = await readApproval(tx, input.approvalId);
  const actor = await readActorQualification(tx, input.actorId);

  if (!actor.isPM) {
    throw lifecycleError("QUALIFICATION_REQUIRED", "只有 PM 資格者可以核定品質文件");
  }
  if (approval.status !== "PENDING_PM") {
    throw lifecycleError("INVALID_STATE", "此品質文件目前不是待 PM 核定狀態");
  }
  if (approval.itemHistory.submittedById === input.actorId) {
    throw lifecycleError("SELF_APPROVAL", "您不能核定自己提交的文件");
  }
  if (approval.revisionCount !== input.expectedRevisionCount) {
    throw lifecycleError("REVISION_MISMATCH", "品質文件已產生新修訂，請重新產生文件後再試");
  }

  const completedAt = new Date();
  const updated = await tx.qCDocumentApproval.updateMany({
    where: {
      id: input.approvalId,
      status: "PENDING_PM",
      revisionCount: input.expectedRevisionCount,
    },
    data: {
      status: "COMPLETED",
      pmApprovedById: input.actorId,
      pmApprovedAt: completedAt,
      pmNote: input.note ?? "同意",
    },
  });
  assertConditionalUpdate(updated.count, "此品質文件已被其他操作更新，請重新整理後再試");

  await tx.itemHistory.update({
    where: { id: approval.itemHistoryId },
    data: { isoDocPath: input.pdfPath },
  });

  const notification = notificationFor(approval);
  return {
    approvalId: approval.id,
    itemHistoryId: approval.itemHistoryId,
    status: "COMPLETED",
    stage: "PM",
    sourceStage: "PM",
    submittedById: approval.itemHistory.submittedById,
    changeRequestId: approval.itemHistory.changeRequestId,
    itemFullId: approval.itemHistory.itemFullId,
    itemTitle: approval.itemHistory.itemTitle,
    notification,
    pdfPath: input.pdfPath,
  };
}
