import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
// import puppeteer from 'puppeteer'; // Dynamic import used instead

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

// Helper to generate PDF from HTML content using Puppeteer
// Helper to generate Full History Page PDF using Puppeteer
const generateHistoryPagePDF = async (history: ItemHistory): Promise<Uint8Array | null> => {
    try {
        const puppeteer = (await import('puppeteer')).default;
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Parse Data
        const snapshot = JSON.parse(history.snapshot);
        const diff = history.diff ? JSON.parse(history.diff) : null;

        // Reconstruct Previous Snapshot (if UPDATE)
        let previousSnapshot = null;
        if (diff && history.changeType === 'UPDATE') {
            previousSnapshot = {
                ...snapshot,
                title: diff.title?.old ?? snapshot.title,
                content: diff.content?.old ?? snapshot.content,
                attachments: diff.attachments?.old ?? snapshot.attachments,
                relatedItems: diff.relatedItems?.old ?? snapshot.relatedItems,
            };
        }

        // Helper to render Diff Section
        const renderDiffSection = () => {
            if (!diff) return '';
            let html = '<div class="section"><h2>變更內容比對</h2>';

            // Helper to render relatedItems as formatted list
            const renderRelatedItems = (items: any[] | null) => {
                if (!items || items.length === 0) return '<em>(無關聯項目)</em>';
                return items.map(item => `
                    <div style="padding: 8px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; background: rgba(255,255,255,0.5);">
                        <strong style="color: #00838f;">${item.fullId || ''}</strong>
                        ${item.title ? ` - ${item.title}` : ''}
                        ${item.description ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${item.description}</div>` : ''}
                    </div>
                `).join('');
            };

            for (const [key, value] of Object.entries(diff) as [string, any][]) {
                const label = key === 'content' ? '內容'
                    : key === 'title' ? '標題'
                        : key === 'relatedItems' ? '關聯項目'
                            : key === 'attachments' ? '參考文獻'
                                : key;

                // Determine how to render the content based on field type
                let oldContent: string;
                let newContent: string;

                if (key === 'content') {
                    oldContent = value.old || '<em>(空白)</em>';
                    newContent = value.new || '<em>(空白)</em>';
                } else if (key === 'relatedItems') {
                    oldContent = renderRelatedItems(value.old);
                    newContent = renderRelatedItems(value.new);
                } else if (key === 'attachments') {
                    // Handle attachments/references - show file names
                    const renderAttachments = (attachments: any) => {
                        if (!attachments) return '<em>(無參考文獻)</em>';
                        try {
                            const files = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
                            if (!Array.isArray(files) || files.length === 0) return '<em>(無參考文獻)</em>';
                            return files.map((f: any) => `
                                <div style="padding: 4px 8px; margin: 2px 0; background: #f5f5f5; border-radius: 4px;">
                                    📎 ${f.name || f.dataName || f.fileName || '未命名'}
                                    ${f.author ? `<span style="color: #666; font-size: 12px;"> - ${f.author}</span>` : ''}
                                    ${f.citation ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">${f.citation}</div>` : ''}
                                </div>
                            `).join('');
                        } catch {
                            return '<em>(無參考文獻)</em>';
                        }
                    };
                    oldContent = renderAttachments(value.old);
                    newContent = renderAttachments(value.new);
                } else {
                    // Default: stringify other values
                    oldContent = typeof value.old === 'object' ? JSON.stringify(value.old, null, 2) : String(value.old ?? '');
                    newContent = typeof value.new === 'object' ? JSON.stringify(value.new, null, 2) : String(value.new ?? '');
                }

                html += `
                    <div class="diff-row">
                        <div class="diff-header">${label}</div>
                        <div class="diff-grid">
                            <div class="diff-old">
                                <div class="diff-label error">修改前</div>
                                <div class="content-box">${oldContent}</div>
                            </div>
                            <div class="diff-new">
                                <div class="diff-label success">修改後</div>
                                <div class="content-box">${newContent}</div>
                            </div>
                        </div>
                    </div>
                 `;
            }
            html += '</div>';
            return html;
        };

        // Helper to render Review Timeline (Round-based)
        const renderReviewTimeline = () => {
            const rounds: any[][] = [];

            // 1. Process reviewChain (Generic requests)
            if (history.reviewChain && history.reviewChain.length > 0) {
                const sortedChain = [...history.reviewChain].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                for (const req of sortedChain) {
                    const roundEvents: any[] = [];
                    roundEvents.push({
                        type: req.previousRequestId ? "重新提交" : "提交",
                        user: req.submittedBy?.username || req.submitterName || "提交者",
                        date: new Date(req.createdAt),
                        note: req.submitReason,
                        status: "info"
                    });
                    if (req.status === "APPROVED" && req.reviewedBy) {
                        roundEvents.push({
                            type: "核准",
                            user: req.reviewedBy.username,
                            date: new Date(req.updatedAt),
                            note: req.reviewNote,
                            status: "success"
                        });
                    } else if ((req.status === "REJECTED" || req.status === "RESUBMITTED") && req.reviewedBy) {
                        roundEvents.push({
                            type: "退回修改",
                            user: req.reviewedBy.username,
                            date: new Date(req.updatedAt),
                            note: req.reviewNote,
                            status: "danger"
                        });
                    }
                    rounds.push(roundEvents);
                }
            } else {
                // Fallback for direct ISO flow without previous chain records
                rounds.push([{
                    type: "提交",
                    user: history.submittedBy?.username || "提交者",
                    date: new Date(history.submissionDate || history.createdAt),
                    note: history.submitReason,
                    status: "info"
                }]);
                if (history.reviewedBy) {
                    rounds[0].push({
                        type: "核准",
                        user: history.reviewedBy.username,
                        date: new Date(history.createdAt),
                        note: history.reviewNote,
                        status: "success"
                    });
                }
            }

            // Append QC/PM to last round
            const lastRound = rounds[rounds.length - 1] || [];
            if (history.qcUser && history.qcDate) {
                lastRound.push({ type: "QC 簽核", user: history.qcUser, date: new Date(history.qcDate), note: history.qcNote, status: "success" });
            }
            if (history.pmUser && history.pmDate) {
                lastRound.push({ type: "PM 簽核", user: history.pmUser, date: new Date(history.pmDate), note: history.pmNote, status: "success" });
            }

            // 2. Process Revisions (ISO flow)
            if (history.revisions && history.revisions.length > 0) {
                for (const rev of history.revisions) {
                    const revRound: any[] = [];
                    revRound.push({
                        type: "退回修改",
                        user: rev.requestedBy?.username || "審核者",
                        date: new Date(rev.requestedAt),
                        note: rev.requestNote,
                        status: "warning"
                    });
                    if (rev.resolvedAt) {
                        revRound.push({
                            type: "重新提交",
                            user: history.submittedBy?.username || "提交者",
                            date: new Date(rev.resolvedAt),
                            note: `完成第 ${rev.revisionNumber} 次修訂`,
                            status: "info"
                        });
                    }
                    rounds.push(revRound);
                }
            }

            if (rounds.length === 0) return '';

            let html = '<div class="section"><h2>審核歷程時間軸</h2><div class="timeline-container">';
            rounds.forEach((round, idx) => {
                html += `<div class="timeline-round">`;
                html += `<div class="round-title">第 ${idx + 1} 次審核</div>`;
                round.forEach(ev => {
                    const color = ev.status === 'success' ? '#10b981' : ev.status === 'warning' ? '#f59e0b' : ev.status === 'danger' ? '#ef4444' : '#3b82f6';
                    html += `
                        <div class="timeline-event">
                            <div class="event-dot" style="background: ${color}"></div>
                            <div class="event-content">
                                <div class="event-header">
                                    <span class="event-type" style="color: ${color}; border-color: ${color}40; background: ${color}15">${ev.type}</span>
                                    <span class="event-user">${ev.user}</span>
                                </div>
                                <div class="event-date">${new Date(ev.date).toLocaleString('zh-TW')}</div>
                                ${ev.note ? `<div class="event-note">${(ev.type === '提交' || ev.type === '重新提交') ? '原因：' : '意見：'}${ev.note}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            });
            html += '</div></div>';
            return html;
        };

        // Helper to render Snapshot Section
        const renderSnapshotSection = (title: string, data: any) => {
            if (!data) return '';

            // Helper to format attachments/references
            const formatAttachments = (attachments: any) => {
                if (!attachments) return '';
                try {
                    const files = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
                    if (!Array.isArray(files) || files.length === 0) return '';
                    const fileList = files.map((f: any) => `
                        <div style="padding: 6px 10px; margin: 4px 0; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #00838f;">
                            📎 ${f.name || f.dataName || f.fileName || '未命名檔案'}
                            ${f.author ? `<span style="color: #666; font-size: 12px;"> - ${f.author}</span>` : ''}
                            ${f.citation ? `<div style="font-size: 12px; color: #666; margin-top: 2px;">${f.citation}</div>` : ''}
                        </div>
                    `).join('');
                    return `<div class="field-group"><label>參考文獻</label><div class="value">${fileList}</div></div>`;
                } catch {
                    return '';
                }
            };

            return `
                <div class="section">
                    <h2>${title}</h2>
                    <div class="field-group">
                        <label>標題</label>
                        <div class="value">${data.title}</div>
                    </div>
                    <div class="field-group">
                        <label>內容</label>
                        <div class="value rich-text">${data.content || '(無內容)'}</div>
                    </div>
                    ${formatAttachments(data.attachments)}
                </div>
             `;
        };


        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: "Arial Unicode MS", Arial, sans-serif; padding: 40px; font-size: 14px; line-height: 1.6; color: #333; }
                    h1 { font-size: 24px; margin-bottom: 5px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    h2 { font-size: 18px; margin-top: 25px; margin-bottom: 15px; border-left: 4px solid #00838f; padding-left: 10px; background: #f9f9f9; padding-top: 5px; padding-bottom: 5px; }
                    .header-info { color: #666; font-size: 14px; margin-bottom: 20px; }
                    
                    .review-card { background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .review-col { padding-left: 15px; border-left: 3px solid #ddd; }
                    .review-col.submitter { border-color: #fca5a5; } 
                    .review-col.reviewer { border-color: #86efac; }
                    .review-col.qc { border-color: #93c5fd; }
                    .review-col.pm { border-color: #fde047; }
                    
                    .label { font-size: 12px; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 5px; }
                    .value { font-weight: bold; font-size: 14px; color: #000; }
                    .date { font-size: 12px; color: #888; margin-top: 2px; }
                    .note-box { background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; margin-top: 8px; font-size: 12px; }
                    
                    .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .diff-old { background: #fff5f5; border: 1px solid #fed7d7; padding: 10px; border-radius: 6px; }
                    .diff-new { background: #f0fff4; border: 1px solid #c6f6d5; padding: 10px; border-radius: 6px; }
                    .diff-label { font-size: 12px; font-weight: bold; margin-bottom: 5px; }
                    .diff-label.error { color: #c53030; }
                    .diff-label.success { color: #2f855a; }
                    .content-box { font-size: 13px; overflow-wrap: break-word; }
                    
                    .field-group { margin-bottom: 15px; }
                    .field-group label { display: block; font-size: 12px; font-weight: bold; color: #666; margin-bottom: 5px; }
                    .rich-text { background: #fff; border: 1px solid #eee; padding: 15px; border-radius: 6px; }
                    
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th, td { border: 1px solid #ddd; padding: 6px; }
                    img { max-width: 100%; }
                    
                    .revision-table { font-size: 12px; }
                    .revision-table th { background: #f5f5f5; font-weight: 600; }
                    .revision-table td { vertical-align: top; }

                    /* Timeline Styles */
                    .timeline-container { display: block; }
                    .timeline-round { border: 1px dashed #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px; background: #fff; }
                    .round-title { font-size: 12px; font-weight: bold; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                    .timeline-event { position: relative; padding-left: 20px; border-left: 2px solid #eee; margin-bottom: 15px; }
                    .event-dot { position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; borderRadius: 50%; border: 2px solid #fff; }
                    .event-header { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
                    .event-type { font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 600; border: 1px solid; }
                    .event-user { font-weight: bold; font-size: 13px; }
                    .event-date { font-size: 11px; color: #888; margin-bottom: 3px; }
                    .event-note { font-size: 12px; background: #f9f9f9; padding: 6px 10px; border-radius: 4px; border: 1px solid #eee; }
                </style>
            </head>
            <body>
                <h1>歷史版本詳情: v${history.version}</h1>
                <div class="header-info">
                    ${history.itemFullId} - ${history.itemTitle} | 變更類型: ${history.changeType}
                </div>

                <!-- Review card removed - moved to page 1 -->

                ${renderReviewTimeline()}

                ${renderDiffSection()}
                
                ${previousSnapshot ? renderSnapshotSection(`變更前快照 (v${history.version - 1})`, previousSnapshot) : ''}
                
                ${(history.changeType === 'CREATE' || history.changeType === 'DELETE') ? renderSnapshotSection(`${history.changeType === 'CREATE' ? '建立' : '刪除'}快照`, snapshot) : ''}
            </body>
            </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
        });

        await browser.close();
        return pdfBuffer;
    } catch (error) {
        console.error('Puppeteer PDF generation failed:', error);
        return null;
    }
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

        const approvalDateStr = formatDate(new Date(history.createdAt));
        drawField('變更日期:', approvalDateStr, y); y -= 25;

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
                    const reviewStatus = req.status === 'APPROVED' ? '核准' : req.status === 'REJECTED' ? '退回' : '已處理';
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
        // ATTACHMENT LOGIC (Puppeteer)
        // Only attach if PM Approved (pmDate is present)
        // ==========================================
        if (history.pmDate) {
            try {
                // Generate History Page PDF
                const contentPdfBytes = await generateHistoryPagePDF(history);

                if (contentPdfBytes) {
                    // Load the generated PDF
                    const contentPdf = await PDFDocument.load(contentPdfBytes);

                    // Copy all pages
                    const contentPages = await pdfDoc.copyPages(contentPdf, contentPdf.getPageIndices());

                    // Add each page to the main document
                    for (const contentPage of contentPages) {
                        pdfDoc.addPage(contentPage);
                    }

                    console.log(`[generateQCDocument] Attached ${contentPages.length} pages of history view.`);
                }
            } catch (err) {
                console.error('[generateQCDocument] Failed to attach history PDF:', err);
                // Continue saving without attachment if this fails
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
