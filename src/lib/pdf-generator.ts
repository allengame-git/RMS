/**
 * @file pdf-generator.ts
 * @description 品質管制文件 (QC Document) PDF 生成模組
 *
 * 此模組負責生成 RMS 系統的品質管制文件 PDF，
 * 記錄項目變更的完整審核歷程。
 *
 * ## 核心功能
 * - `generateQCDocument`：生成 QC 文件 PDF
 * - `generateHistorySummaryPages`：生成歷史版本摘要頁面
 *
 * ## PDF 內容結構
 * 1. **封面資訊**：文件編號、專案名稱、項目資訊、版本號
 * 2. **審核歷程**：
 *    - 提交人員與編輯意見
 *    - 核准人員與審查意見
 *    - QC 審核簽名區塊
 *    - PM 核定簽名區塊
 * 3. **歷史詳情**（PM 核定後附加）：
 *    - 變更內容比對（新舊版本差異）
 *    - 快照摘要
 *
 * ## 技術實作
 * - 使用 `pdf-lib` 純 JavaScript 庫生成 PDF
 * - 支援中文字體（Arial Unicode）
 * - 檔案輸出至 `/public/iso_doc/` 目錄
 *
 * ## 文件命名規則
 * `QC-{專案代碼}-{歷史ID}.pdf`
 * 例如：`QC-RMS-123.pdf`
 *
 * ## 生成時機
 * - 僅在 PM 核定後才會生成 PDF
 * - 可透過 `regenerateQCDocument` 重新生成
 *
 * @see /src/actions/qc-approval.ts - QC 審查流程（觸發 PDF 生成）
 * @see /src/actions/history.ts - 歷史紀錄管理
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
// Note: html-renderer (Puppeteer) removed - using pure pdf-lib for all PDF generation

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
    const _formatDate = (date: Date | string) => {
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
    // Section 1: 變更內容比對 (if UPDATE)
    // 注意：審核歷程時間軸已在第一頁顯示，此處不重複
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
    _item: Item | null
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
        // 第二頁: 歷史版本詳情 (純 pdf-lib 直接排版)
        // 只有在 PM 核定後才附加詳細資料頁面
        // ==========================================
        if (history.pmDate) {
            try {
                await generateHistorySummaryPages(history, pdfDoc, font);
                console.log('[generateQCDocument] Added history summary pages (pdf-lib, no Puppeteer).');
            } catch (err) {
                console.error('[generateQCDocument] Failed to generate history summary pages:', err);
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
