import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { renderHtmlToImage, renderHtmlToPdf } from './html-renderer';
import { formatDate, formatDateTime } from './date-utils';

// Types
interface ItemHistory {
    id: number;
    itemId: number | null;
    version: number;
    changeType: string;
    itemFullId: string;
    itemTitle: string;
    submittedBy: { username: string } | null;
    reviewedBy: { username: string } | null;
    createdAt: Date; // Approval Date
    submissionDate?: Date; // Submission Date
    projectId: number;
    project: { title: string; codePrefix: string };
    snapshot: string; // JSON string
    diff: string | null; // JSON string
    submitReason?: string | null;
    reviewNote?: string | null;

    // QC/PM Fields (Passed explicitly during regeneration)
    qcNote?: string | null;
    qcDate?: Date | null;
    qcUser?: string | null;
    pmNote?: string | null;
    pmDate?: Date | null;
    pmUser?: string | null;

    // Revision History (for PDF generation)
    revisions?: Array<{
        revisionNumber: number;
        requestedBy?: { username: string } | null;
        requestedAt: Date;
        requestNote: string;
        resolvedAt?: Date | null;
    }>;
    reviewChain?: any[]; // For generic change requests
}

interface Item {
    fullId: string;
    title: string;
}

/**
 * Generate History Summary Pages using pdf-lib (no Puppeteer)
 * Returns additional pages to be appended to the main QC document
 */
const generateHistorySummaryPages = async (
    history: ItemHistory,
    pdfDoc: PDFDocument,
    font: any
): Promise<void> => {
    const { width, height } = { width: 595.28, height: 841.89 }; // A4
    const margin = 50;
    const lineHeight = 16;
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);
    const blue = rgb(0, 0.4, 0.6);
    const green = rgb(0.1, 0.6, 0.3);
    const red = rgb(0.8, 0.2, 0.2);

    // Date Formatter
    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}/${m}/${day} ${h}:${min}`;
    };

    // Strip HTML tags for plain text display
    const stripHtml = (html: string | null | undefined): string => {
        if (!html) return '(無內容)';
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim() || '(無內容)';
    };

    // Create new page
    let page = pdfDoc.addPage([width, height]);
    let y = height - margin;

    // Helper: Check if need new page
    const checkNewPage = (neededSpace: number = 100) => {
        if (y < margin + neededSpace) {
            page = pdfDoc.addPage([width, height]);
            y = height - margin;
        }
    };

    // Helper: Draw section title
    const drawSectionTitle = (title: string) => {
        checkNewPage(60);
        page.drawRectangle({
            x: margin,
            y: y - 5,
            width: width - 2 * margin,
            height: 25,
            color: rgb(0.95, 0.95, 0.95)
        });
        page.drawText(title, { x: margin + 10, y: y, size: 12, font, color: blue });
        y -= 35;
    };

    // Helper: Draw key-value line
    const drawField = (label: string, value: string, labelColor = gray) => {
        checkNewPage(25);
        page.drawText(label, { x: margin, y, size: 9, font, color: labelColor });

        // Wrap long values
        const maxWidth = width - margin - 130;
        const lines = wrapText(value, font, 9, maxWidth);
        for (let i = 0; i < Math.min(lines.length, 5); i++) { // Limit to 5 lines
            page.drawText(lines[i], { x: margin + 80, y, size: 9, font, color: black });
            if (i < lines.length - 1) y -= lineHeight;
        }
        if (lines.length > 5) {
            y -= lineHeight;
            page.drawText('...（內容過長已截斷）', { x: margin + 80, y, size: 8, font, color: gray });
        }
        y -= lineHeight + 5;
    };

    // ==========================================
    // Page Header
    // ==========================================
    page.drawText(`歷史版本詳情: v${history.version}`, { x: margin, y, size: 16, font, color: black });
    y -= 25;
    page.drawText(`${history.itemFullId} - ${history.itemTitle}`, { x: margin, y, size: 10, font, color: gray });
    y -= 15;

    const changeTypeMap: { [k: string]: string } = { 'CREATE': '新增', 'UPDATE': '修改', 'DELETE': '刪除', 'RESTORE': '還原' };
    page.drawText(`變更類型: ${changeTypeMap[history.changeType] || history.changeType}`, { x: margin, y, size: 10, font, color: gray });
    y -= 30;

    // ==========================================
    // Section 1: 審核歷程時間軸
    // ==========================================
    drawSectionTitle('審核歷程時間軸');

    // Build timeline events
    type TimelineEvent = { type: string; user: string; date: Date; note?: string; status: 'info' | 'success' | 'warning' | 'danger' };
    const events: TimelineEvent[] = [];

    if (history.reviewChain && history.reviewChain.length > 0) {
        const sortedChain = [...history.reviewChain].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        for (const req of sortedChain) {
            events.push({
                type: req.previousRequestId ? '重新提交' : '提交',
                user: req.submittedBy?.username || req.submitterName || '提交者',
                date: new Date(req.createdAt),
                note: req.submitReason,
                status: 'info'
            });
            if (req.status === 'APPROVED' && req.reviewedBy) {
                events.push({
                    type: '核准',
                    user: req.reviewedBy.username,
                    date: new Date(req.updatedAt),
                    note: req.reviewNote,
                    status: 'success'
                });
            } else if ((req.status === 'REJECTED' || req.status === 'RESUBMITTED') && req.reviewedBy) {
                events.push({
                    type: '退回修改',
                    user: req.reviewedBy.username,
                    date: new Date(req.updatedAt),
                    note: req.reviewNote,
                    status: 'danger'
                });
            }
        }
    } else {
        // Fallback
        events.push({
            type: '提交',
            user: history.submittedBy?.username || '提交者',
            date: new Date(history.submissionDate || history.createdAt),
            note: history.submitReason || undefined,
            status: 'info'
        });
        if (history.reviewedBy) {
            events.push({
                type: '核准',
                user: history.reviewedBy.username,
                date: new Date(history.createdAt),
                note: history.reviewNote || undefined,
                status: 'success'
            });
        }
    }

    // Add QC/PM
    if (history.qcUser && history.qcDate) {
        events.push({ type: 'QC 簽核', user: history.qcUser, date: new Date(history.qcDate), note: history.qcNote || undefined, status: 'success' });
    }
    if (history.pmUser && history.pmDate) {
        events.push({ type: 'PM 簽核', user: history.pmUser, date: new Date(history.pmDate), note: history.pmNote || undefined, status: 'success' });
    }

    // Draw timeline events
    for (const ev of events) {
        checkNewPage(50);
        const statusColor = ev.status === 'success' ? green : ev.status === 'danger' ? red : ev.status === 'warning' ? rgb(0.9, 0.6, 0) : blue;

        // Bullet
        page.drawCircle({ x: margin + 5, y: y + 3, size: 4, color: statusColor });

        // Type + User
        page.drawText(`[${ev.type}]`, { x: margin + 15, y, size: 9, font, color: statusColor });
        page.drawText(ev.user, { x: margin + 80, y, size: 9, font, color: black });
        page.drawText(formatDate(ev.date), { x: width - margin - 100, y, size: 8, font, color: gray });
        y -= lineHeight;

        // Note
        if (ev.note) {
            const noteLines = wrapText(ev.note, font, 8, width - margin - 100);
            for (let i = 0; i < Math.min(noteLines.length, 3); i++) {
                page.drawText(noteLines[i], { x: margin + 20, y, size: 8, font, color: gray });
                y -= lineHeight - 2;
            }
        }
        y -= 8;
    }

    // ==========================================
    // Section 2: 變更內容比對 (if UPDATE)
    // ==========================================
    const diff = history.diff ? JSON.parse(history.diff) : null;
    if (diff && history.changeType === 'UPDATE') {
        drawSectionTitle('變更內容比對');

        for (const [key, value] of Object.entries(diff) as [string, any][]) {
            checkNewPage(80);
            const label = key === 'content' ? '內容' : key === 'title' ? '標題' : key === 'relatedItems' ? '關聯項目' : key === 'attachments' ? '參考文獻' : key;

            page.drawText(`【${label}】`, { x: margin, y, size: 10, font, color: black });
            y -= lineHeight + 5;

            // Old value
            page.drawText('修改前:', { x: margin + 10, y, size: 9, font, color: red });
            y -= lineHeight;
            const oldText = key === 'content' ? stripHtml(value.old) : (typeof value.old === 'object' ? JSON.stringify(value.old) : String(value.old || '(空白)'));
            const oldLines = wrapText(oldText.slice(0, 500), font, 8, width - margin - 80);
            for (let i = 0; i < Math.min(oldLines.length, 4); i++) {
                page.drawText(oldLines[i], { x: margin + 20, y, size: 8, font, color: gray });
                y -= lineHeight - 2;
            }
            if (oldText.length > 500) {
                page.drawText('...（已截斷）', { x: margin + 20, y, size: 8, font, color: gray });
                y -= lineHeight;
            }
            y -= 5;

            // New value
            page.drawText('修改後:', { x: margin + 10, y, size: 9, font, color: green });
            y -= lineHeight;
            const newText = key === 'content' ? stripHtml(value.new) : (typeof value.new === 'object' ? JSON.stringify(value.new) : String(value.new || '(空白)'));
            const newLines = wrapText(newText.slice(0, 500), font, 8, width - margin - 80);
            for (let i = 0; i < Math.min(newLines.length, 4); i++) {
                page.drawText(newLines[i], { x: margin + 20, y, size: 8, font, color: gray });
                y -= lineHeight - 2;
            }
            if (newText.length > 500) {
                page.drawText('...（已截斷）', { x: margin + 20, y, size: 8, font, color: gray });
                y -= lineHeight;
            }
            y -= 15;
        }
    }

    // ==========================================
    // Section 3: 快照摘要
    // ==========================================
    const snapshot = JSON.parse(history.snapshot);
    drawSectionTitle(history.changeType === 'CREATE' ? '建立快照' : history.changeType === 'DELETE' ? '刪除快照' : '當前快照');

    drawField('標題:', snapshot.title || '(無標題)');

    // Content (stripped HTML)
    const contentText = stripHtml(snapshot.content);
    drawField('內容摘要:', contentText.length > 800 ? contentText.slice(0, 800) + '...（詳見系統）' : contentText);

    // Attachments summary
    if (snapshot.attachments) {
        try {
            const files = typeof snapshot.attachments === 'string' ? JSON.parse(snapshot.attachments) : snapshot.attachments;
            if (Array.isArray(files) && files.length > 0) {
                const fileNames = files.map((f: any) => f.name || f.dataName || f.fileName || '未命名').join(', ');
                drawField('參考文獻:', `共 ${files.length} 項 - ${fileNames.slice(0, 200)}${fileNames.length > 200 ? '...' : ''}`);
            }
        } catch { /* ignore */ }
    }

    // Related items summary
    if (snapshot.relatedItems && Array.isArray(snapshot.relatedItems) && snapshot.relatedItems.length > 0) {
        const relatedStr = snapshot.relatedItems.map((r: any) => r.fullId || r.title || '項目').join(', ');
        drawField('關聯項目:', `共 ${snapshot.relatedItems.length} 項 - ${relatedStr.slice(0, 200)}${relatedStr.length > 200 ? '...' : ''}`);
    }

    // Footer note
    checkNewPage(40);
    y -= 20;
    page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: gray });
    y -= 10;
    page.drawText('※ 此為簡化版歷史摘要，完整內容請於系統中查閱。', { x: margin, y, size: 8, font, color: gray });
};


export const generateQCDocument = async (
    history: ItemHistory,
    item: Item | null
): Promise<string> => {
    console.log('[generateQCDocument] Starting PDF generation for history:', history.id);

    try {
        // Create a new PDF document or load existing? No, always new based on request.
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        // Try to load Chinese font
        let font;
        const fontPath = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
        if (fs.existsSync(fontPath)) {
            const fontBytes = fs.readFileSync(fontPath);
            font = await pdfDoc.embedFont(fontBytes, { subset: true });
        } else {
            console.warn('[generateQCDocument] Chinese font not found, using Helvetica');
            font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }

        // Add a page
        const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
        const { width, height } = page.getSize();
        const margin = 50;
        const black = rgb(0, 0, 0);
        const gray = rgb(0.5, 0.5, 0.5);

        let y = height - margin;

        // Header
        const title = '品質管理文件 - 專案變更紀錄';
        const titleWidth = font.widthOfTextAtSize(title, 20);
        page.drawText(title, { x: (width - titleWidth) / 2, y: y - 20, size: 20, font, color: black });
        y -= 60;

        // Document Info Helper
        const drawField = (label: string, value: string, yPos: number) => {
            page.drawText(label, { x: margin, y: yPos, size: 10, font, color: gray });
            page.drawText(value || '-', { x: margin + 100, y: yPos, size: 10, font, color: black });
        };

        // Date Formatter (YYYY/MM/DD HH:mm)
        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            return `${y}/${m}/${d} ${h}:${min}`;
        };

        // Info Table
        const projectCode = history.project.codePrefix || String(history.projectId);
        drawField('文件編號:', `QC-${projectCode}-${history.id}`, y); y -= 25;
        drawField('專案名稱:', history.project.title, y); y -= 25;
        drawField('項目編號:', history.itemFullId, y); y -= 25;
        drawField('項目名稱:', history.itemTitle, y); y -= 25;
        drawField('版本號碼:', `v${history.version}`, y); y -= 25;

        const changeTypeMap: { [key: string]: string } = { 'CREATE': '新增', 'UPDATE': '修改', 'DELETE': '刪除', 'RESTORE': '還原' };
        drawField('變更類型:', changeTypeMap[history.changeType] || history.changeType, y); y -= 25;

        // Divider
        page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: gray });
        y -= 10;

        // Helper for Multi-line with optional Date
        const drawSection = (label: string, user: string, date: Date | undefined | null, noteLabel: string, note: string | null | undefined, startY: number) => {
            let currentY = startY;

            // Name Line with Date
            page.drawText(label, { x: margin, y: currentY, size: 10, font, color: gray });
            page.drawText(user || 'N/A', { x: margin + 100, y: currentY, size: 10, font, color: black });

            if (date) {
                const dateStr = formatDate(new Date(date));
                page.drawText(`日期: ${dateStr}`, { x: width - margin - 150, y: currentY, size: 10, font, color: black });
            }
            currentY -= 15;

            // Note Line (Multi-line)
            page.drawText(noteLabel, { x: margin, y: currentY, size: 10, font, color: gray });
            const lines = wrapText(note || '(無)', font, 10, width - margin - 120);
            for (const line of lines) {
                page.drawText(line, { x: margin + 100, y: currentY, size: 10, font, color: black });
                currentY -= 15;
            }

            return currentY - 10; // Extra spacing
        };

        // ==========================================
        // Draw All Review Rounds (if reviewChain exists)
        // ==========================================
        if (history.reviewChain && history.reviewChain.length > 0) {
            const sortedChain = [...history.reviewChain].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            for (let i = 0; i < sortedChain.length; i++) {
                const req = sortedChain[i];
                const roundLabel = sortedChain.length > 1 ? `【第 ${i + 1} 輪】` : '';

                // Check page overflow - skip if too little space (rare edge case)
                if (y < 150) {
                    console.warn('[generateQCDocument] Page overflow, some content may be truncated');
                    break; // Simple handling: stop adding more rounds
                }

                // Round Header
                if (roundLabel) {
                    page.drawText(roundLabel, { x: margin, y, size: 11, font, color: rgb(0, 0.4, 0.5) });
                    y -= 20;
                }

                // Submitter
                y = drawSection(
                    '提交人員:',
                    req.submittedBy?.username || req.submitterName || 'N/A',
                    new Date(req.createdAt),
                    '編輯意見:',
                    req.submitReason || req.submitNote,
                    y
                );
                y -= 5;

                // Reviewer (if approved or rejected)
                if (req.reviewedBy || req.status === 'APPROVED' || req.status === 'REJECTED' || req.status === 'RESUBMITTED') {
                    const reviewerName = req.reviewedBy?.username || 'N/A';
                    // 統一使用「核准」或「退回」，不使用「已處理」
                    const reviewStatus = req.status === 'REJECTED' || req.status === 'RESUBMITTED' ? '退回' : '核准';
                    y = drawSection(
                        `${reviewStatus}人員:`,
                        reviewerName,
                        req.updatedAt ? new Date(req.updatedAt) : null,
                        '審查意見:',
                        req.reviewNote,
                        y
                    );
                    y -= 10;
                }
            }
        } else {
            // Fallback: Single round (original logic)
            y = drawSection('提交人員:', history.submittedBy?.username || 'N/A', history.submissionDate, '編輯意見:', history.submitReason, y);
            y -= 10;
            y = drawSection('核准人員:', history.reviewedBy?.username || 'N/A', history.createdAt, '審查意見:', history.reviewNote, y);
        }
        y -= 25;

        // Divider
        page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 1, color: gray });
        y -= 20;

        // QC / PM Signatures
        const sigBoxWidth = (width - 2 * margin - 20) / 2;
        const sigBoxHeight = 100;

        // Check page overflow
        if (y - sigBoxHeight < 50) {
            // pdfDoc.addPage... (Simple logic: just assume it fits or layout is minimal)
        }

        // Helper to draw signature box content
        const drawSigBox = (x: number, title: string, user: string | null | undefined, note: string | null | undefined, date: Date | null | undefined) => {
            page.drawRectangle({ x, y: y - sigBoxHeight, width: sigBoxWidth, height: sigBoxHeight, borderColor: gray, borderWidth: 1 });
            page.drawText(title, { x: x + 10, y: y - 20, size: 10, font, color: gray });

            // User Name
            if (user) {
                page.drawText(user, { x: x + 120, y: y - 20, size: 10, font, color: black });
            }

            // Note
            page.drawText('意見:', { x: x + 10, y: y - 50, size: 9, font, color: gray });
            if (note) {
                const lines = wrapText(note, font, 9, sigBoxWidth - 20);
                if (lines.length > 0) {
                    page.drawText(lines[0], { x: x + 40, y: y - 50, size: 9, font, color: black });
                } else {
                    page.drawText('(無)', { x: x + 40, y: y - 50, size: 9, font, color: black });
                }
            }

            // Date
            page.drawText('日期:', { x: x + 10, y: y - 80, size: 9, font, color: gray });
            if (date) {
                const dateStr = formatDate(new Date(date));
                page.drawText(dateStr, { x: x + 40, y: y - 80, size: 9, font, color: black });
            } else {
                page.drawText('_____________', { x: x + 40, y: y - 80, size: 9, font, color: gray });
            }
        };

        drawSigBox(margin, '品質管制審核 (QC)', history.qcUser, history.qcNote, history.qcDate);
        drawSigBox(width - margin - sigBoxWidth, '計畫主管核定 (PM)', history.pmUser, history.pmNote, history.pmDate);

        // ==========================================
        // ATTACHMENT: History Content Screenshot (Puppeteer)
        // Only attach if PM Approved (pmDate is present)
        // ==========================================
        if (history.pmDate) {
            try {
                // Parse snapshot to get HTML content
                const snapshot = JSON.parse(history.snapshot);

                // 0. Process Image URLs and Fix HTML content
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                let htmlContent = snapshot.content || '<p>(無內容)</p>';

                // Replace relative image URLs with absolute ones for Puppeteer
                htmlContent = htmlContent.replace(/src="\/api\/image\/([^"]+)"/g, `src="${baseUrl}/api/image/$1"`);

                const diff = history.diff ? JSON.parse(history.diff) : null;
                const reviewChain = (history as any).reviewChain || [];

                // 1. Build Timeline HTML (Vertical layout to avoid truncation)
                let timelineHtml = '';
                if (reviewChain.length > 0) {
                    const sortedChain = [...reviewChain].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                    timelineHtml = `
                        <div class="section-title">審核時間軸</div>
                        <div class="timeline-vertical">
                            ${sortedChain.map((req, idx) => `
                                <div class="timeline-cycle">
                                    <div class="cycle-label">第 ${idx + 1} 次審核週期</div>
                                    <div class="event">
                                        <div class="event-dot info"></div>
                                        <div class="event-content">
                                            <div class="event-header">
                                                <span class="badge info">${req.previousRequestId ? '重新提交' : '提交'}</span>
                                                <span class="user">${req.submittedBy?.username || req.submitterName || '提交者'}</span>
                                                <span class="date">${formatDateTime(req.createdAt)}</span>
                                            </div>
                                            ${req.submitReason ? `<div class="note">編輯原因：${req.submitReason}</div>` : ''}
                                        </div>
                                    </div>
                                    ${req.reviewedBy ? `
                                        <div class="event">
                                            <div class="event-dot ${req.status === 'APPROVED' ? 'success' : 'danger'}"></div>
                                            <div class="event-content">
                                                <div class="event-header">
                                                    <span class="badge ${req.status === 'APPROVED' ? 'success' : 'danger'}">${req.status === 'APPROVED' ? '核准' : '退回修改'}</span>
                                                    <span class="user">${req.reviewedBy.username}</span>
                                                    <span class="date">${formatDateTime(req.updatedAt)}</span>
                                                </div>
                                                ${req.reviewNote ? `<div class="note">審查意見：${req.reviewNote}</div>` : ''}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }

                // Helper to format list items (relatedItems / references / attachments)
                const formatListData = (key: string, data: any) => {
                    if (!Array.isArray(data) || data.length === 0) {
                        if (typeof data === 'string' && data.startsWith('[')) {
                            try {
                                data = JSON.parse(data);
                            } catch (e) { return '(無內容)'; }
                        } else if (typeof data !== 'object') {
                            return String(data || '(無內容)');
                        }
                    }
                    if (!Array.isArray(data) || data.length === 0) return '(無內容)';

                    if (key === 'relatedItems') {
                        return `<div class="list-container">${data.map(ri => `
                            <div class="list-item">
                                <div class="list-id">${ri.fullId}</div>
                                <div class="list-body">${ri.title || ''}</div>
                            </div>
                        `).join('')}</div>`;
                    }
                    if (key === 'references') {
                        return `<div class="list-container">${data.map(ref => `
                            <div class="list-item">
                                <div class="list-id">${ref.dataName} (${ref.dataYear})</div>
                                <div class="list-body">作者: ${ref.author}</div>
                            </div>
                        `).join('')}</div>`;
                    }
                    if (key === 'attachments' || (key === 'references' && data[0]?.path)) {
                        return `<div class="list-container">${data.map(file => `
                            <div class="list-item">
                                <div class="list-id">📎 ${file.name || '未命名檔案'}</div>
                                <div class="list-body">${file.path ? `路徑: ${file.path}` : ''}</div>
                            </div>
                        `).join('')}</div>`;
                    }
                    return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
                };

                // 2. Build Diff HTML
                let diffHtml = '';
                if (diff) {
                    diffHtml = `<div class="section-title">變更內容</div>`;
                    for (const [key, value] of Object.entries(diff) as [string, any][]) {
                        const label = key === 'relatedItems' ? '關聯項目' : key === 'references' ? '參考文獻' : key === 'content' ? '內容' : key === 'title' ? '標題' : key === 'attachments' ? '附件' : key;
                        const isHtml = key === 'content';
                        const isList = key === 'relatedItems' || key === 'references' || key === 'attachments';

                        diffHtml += `
                            <div class="diff-item">
                                <div class="diff-label">${label}</div>
                                <div class="diff-grid">
                                    <div class="diff-box old">
                                        <div class="diff-tag">修改前</div>
                                        ${isHtml ? `<div class="rich-text-content">${value.old || '(空白)'}</div>` : (isList ? formatListData(key, value.old) : `<pre>${typeof value.old === 'object' ? JSON.stringify(value.old, null, 2) : String(value.old ?? '')}</pre>`)}
                                    </div>
                                    <div class="diff-box new">
                                        <div class="diff-tag">修改後</div>
                                        ${isHtml ? `<div class="rich-text-content">${value.new || '(空白)'}</div>` : (isList ? formatListData(key, value.new) : `<pre>${typeof value.new === 'object' ? JSON.stringify(value.new, null, 2) : String(value.new ?? '')}</pre>`)}
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }

                // 3. Build Full Template
                const fullTemplate = `
                    <style>
                        body { font-family: sans-serif; padding: 20px; color: #333; line-height: 1.5; }
                        .section-title { font-size: 18px; font-weight: bold; margin: 30px 0 15px; border-bottom: 2px solid #00838f; color: #00838f; padding-bottom: 5px; }
                        
                        .timeline-vertical { display: flex; flexDirection: column; gap: 10px; }
                        .timeline-cycle { border: 1px solid #eee; borderRadius: 8px; padding: 15px; background: #fafafa; margin-bottom: 10px; }
                        .cycle-label { font-size: 13px; font-weight: bold; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                        
                        .event { position: relative; padding-left: 20px; border-left: 2px solid #eee; margin-bottom: 15px; }
                        .event:last-child { margin-bottom: 0; }
                        .event-dot { position: absolute; left: -6px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: #ddd; border: 2px solid #fff; }
                        .event-dot.info { background: #3b82f6; }
                        .event-dot.success { background: #10b981; }
                        .event-dot.danger { background: #ef4444; }
                        .event-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
                        .badge { font-size: 10px; padding: 2px 6px; border-radius: 10px; color: #fff; font-weight: bold; }
                        .badge.info { background: #3b82f6; }
                        .badge.success { background: #10b981; }
                        .badge.danger { background: #ef4444; }
                        .user { font-weight: bold; font-size: 13px; }
                        .date { font-size: 11px; color: #888; margin-left: auto; }
                        .note { font-size: 12px; background: #fff; padding: 8px; border-radius: 4px; margin-top: 5px; border: 1px solid #eee; border-left: 3px solid #ddd; word-break: break-word; }
                        
                        img { max-width: 100%; height: auto; object-fit: contain; display: block; margin: 10px 0; border-radius: 4px; }

                        .diff-item { margin-bottom: 25px; }
                        .diff-label { font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #555; text-transform: uppercase; }
                        .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                        .diff-box { padding: 15px; border-radius: 8px; border: 1px solid #eee; position: relative; }
                        .diff-box.old { background: #fff5f5; border-color: #feb2b2; }
                        .diff-box.new { background: #f0fff4; border-color: #9ae6b4; }
                        .diff-tag { font-size: 10px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
                        .old .diff-tag { color: #c53030; }
                        .new .diff-tag { color: #276749; }
                        pre { font-size: 12px; white-space: pre-wrap; margin: 0; overflow: hidden; }

                        .list-container { display: flex; flex-direction: column; gap: 5px; }
                        .list-item { font-size: 12px; padding: 5px; background: rgba(255,255,255,0.5); border-radius: 4px; border: 1px solid rgba(0,0,0,0.05); }
                        .list-id { font-weight: bold; color: #00838f; font-family: monospace; }
                        .list-body { color: #666; font-size: 11px; }

                        .snapshot-section { margin-top: 40px; }
                        .snapshot-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #fff; }
                        .snapshot-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; }

                        .rich-text-content { font-size: 13px; }
                        .rich-text-content ol { counter-reset: item; list-style-type: none; padding-left: 0; }
                        .rich-text-content li { display: block; position: relative; padding-left: 2.5em; margin-bottom: 0.5em; }
                        .rich-text-content li::before { content: counters(item, ".") ". "; counter-increment: item; position: absolute; left: 0; font-weight: bold; color: #00838f; width: 2.2em; text-align: right; }
                        .rich-text-content li p { margin: 0; display: inline; }
                        .rich-text-content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                        .rich-text-content th, .rich-text-content td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .rich-text-content th { background: #f5f5f5; }
                    </style>
                    <div class="header">
                        <div style="font-size: 24px; font-weight: bold; color: #00838f;">歷史版本快照 - v${history.version}</div>
                        <div style="color: #666;">項目：${history.itemFullId} - ${history.itemTitle}</div>
                    </div>

                    ${timelineHtml}
                    ${diffHtml}

                    <div class="snapshot-section">
                        <div class="section-title">版本內容快照 (最終狀態)</div>
                        <div class="snapshot-card">
                            <div style="margin-bottom: 15px;">
                                <div style="font-size: 12px; color: #666; font-weight: bold; margin-bottom: 5px;">標題</div>
                                <div class="snapshot-title">${snapshot.title}</div>
                            </div>
                            
                            <div style="margin-bottom: 20px;">
                                <div style="font-size: 12px; color: #666; font-weight: bold; margin-bottom: 5px;">內容</div>
                                <div class="rich-text-content">${htmlContent}</div>
                            </div>

                            ${snapshot.relatedItems && snapshot.relatedItems.length > 0 ? `
                                <div style="margin-bottom: 20px;">
                                    <div style="font-size: 12px; color: #666; font-weight: bold; margin-bottom: 10px;">關聯項目</div>
                                    ${formatListData('relatedItems', snapshot.relatedItems)}
                                </div>
                            ` : ''}

                            ${snapshot.references && snapshot.references.length > 0 ? `
                                <div style="margin-bottom: 20px;">
                                    <div style="font-size: 12px; color: #666; font-weight: bold; margin-bottom: 10px;">參考文獻</div>
                                    ${formatListData('references', snapshot.references)}
                                </div>
                            ` : ''}

                            ${snapshot.attachments && snapshot.attachments.length > 0 ? `
                                <div style="margin-bottom: 20px;">
                                    <div style="font-size: 12px; color: #666; font-weight: bold; margin-bottom: 10px;">附件</div>
                                    ${formatListData('attachments', snapshot.attachments)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;

                // Use Puppeteer to capture enhanced history PDF
                console.log('[generateQCDocument] Generating enhanced history PDF with Puppeteer...');
                const historyPdfBuffer = await renderHtmlToPdf(fullTemplate);

                // Load the generated history PDF
                const historyPdfDoc = await PDFDocument.load(historyPdfBuffer);
                const historyPages = await pdfDoc.copyPages(historyPdfDoc, historyPdfDoc.getPageIndices());

                // Add pages to main document
                historyPages.forEach((historyPage) => {
                    pdfDoc.addPage(historyPage);
                });

                console.log(`[generateQCDocument] Attached ${historyPages.length} history pages successfully.`);
            } catch (err) {
                console.error('[generateQCDocument] Failed to generate history PDF:', err);
                // Fallback: try text-based summary if PDF generation fails
                try {
                    await generateHistorySummaryPages(history, pdfDoc, font);
                    console.log('[generateQCDocument] Fallback: Added text-based history summary.');
                } catch (fallbackErr) {
                    console.error('[generateQCDocument] Fallback also failed:', fallbackErr);
                }
            }
        }

        // Ensure output directory exists
        const outDir = path.join(process.cwd(), 'public', 'iso_doc');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        // Save PDF
        // Use stable filename matching document ID: QC-[ProjectCode]-[HistoryID].pdf
        const fileName = `QC-${projectCode}-${history.id}.pdf`;
        const filePath = path.join(outDir, fileName);
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(filePath, pdfBytes);

        console.log('[generateQCDocument] PDF saved successfully:', filePath);
        return `/iso_doc/${fileName}`;

    } catch (error) {
        console.error('[generateQCDocument] Error:', error);
        throw error;
    }
};

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    if (!text) return [];
    const words = text.split(''); // Split by character for better Chinese wrapping
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}
