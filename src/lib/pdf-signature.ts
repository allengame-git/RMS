import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

/**
 * Embed a signature image into an existing PDF at a specified position
 * @param pdfPath - Relative path to the PDF (e.g., "/iso_doc/qc_123.pdf")
 * @param signaturePath - Relative path to the signature image
 * @param position - "qc" for QC signature block, "pm" for PM signature block
 * @param signerName - Name of the signer to add as text
 */
export async function embedSignatureInPDF(
    pdfPath: string,
    signaturePath: string,
    position: "qc" | "pm",
    signerName: string
): Promise<void> {
    // Resolve to absolute paths
    const absolutePdfPath = path.join(process.cwd(), "public", pdfPath);
    const absoluteSignaturePath = path.join(process.cwd(), "public", signaturePath);

    // Check if files exist
    if (!fs.existsSync(absolutePdfPath)) {
        throw new Error(`PDF file not found: ${absolutePdfPath}`);
    }
    if (!fs.existsSync(absoluteSignaturePath)) {
        throw new Error(`Signature file not found: ${absoluteSignaturePath}`);
    }

    // Load existing PDF
    const existingPdfBytes = fs.readFileSync(absolutePdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Load signature image
    const signatureBytes = fs.readFileSync(absoluteSignaturePath);
    const signatureExt = path.extname(absoluteSignaturePath).toLowerCase();

    let signatureImage;
    if (signatureExt === ".png") {
        signatureImage = await pdfDoc.embedPng(signatureBytes);
    } else if (signatureExt === ".jpg" || signatureExt === ".jpeg") {
        signatureImage = await pdfDoc.embedJpg(signatureBytes);
    } else {
        throw new Error(`Unsupported image format: ${signatureExt}. Use PNG or JPG.`);
    }

    // Get the first page (signature blocks are on the last page typically)
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height: _height } = lastPage.getSize();

    // Define signature positions (based on the PDF layout from pdf-generator.ts)
    // The PDF is A4: 595.28 x 841.89 points
    // Signature boxes are defined in pdf-generator.ts:
    // - QC box: x=50 (margin), y=50 (sigY-50), width=150, height=70
    // - PM box: x=395.28 (width-margin-150), y=50, width=150, height=70
    // sigY = 100, so boxes are from y=50 to y=120

    const margin = 50;
    const sigBoxWidth = 150;
    const sigBoxHeight = 70;
    const sigBoxY = 50; // sigY - 50 from pdf-generator.ts

    // Signature dimensions (scale to fit inside the box with padding)
    const maxSigWidth = 100;
    const maxSigHeight = 45;

    // Position coordinates - center the signature inside each box
    let boxX: number;

    if (position === "qc") {
        // QC signature box starts at x=margin (50)
        boxX = margin;
    } else {
        // PM signature box starts at x=width-margin-sigBoxWidth
        // width = 595.28, so PM box x = 595.28 - 50 - 150 = 395.28
        boxX = width - margin - sigBoxWidth;
    }

    // Scale image to fit within max dimensions
    const scale = Math.min(maxSigWidth / signatureImage.width, maxSigHeight / signatureImage.height);
    const scaledWidth = signatureImage.width * scale;
    const scaledHeight = signatureImage.height * scale;

    // Center the signature inside the box
    // Horizontal center: boxX + (sigBoxWidth - scaledWidth) / 2
    // Vertical center: sigBoxY + (sigBoxHeight - scaledHeight) / 2, but leave room for label at top
    const x = boxX + (sigBoxWidth - scaledWidth) / 2;
    const y = sigBoxY + 5 + (sigBoxHeight - scaledHeight - 15) / 2; // 15px reserved for label space at top

    // Draw the signature image
    lastPage.drawImage(signatureImage, {
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight,
    });

    // Add signer name and timestamp below signature
    const _timestamp = new Date().toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });

    // Note: pdf-lib has limited font support for Chinese characters
    // We'll use the built-in Helvetica for name/date display
    // For proper Chinese support, you'd need to embed a Chinese font

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(absolutePdfPath, modifiedPdfBytes);

    console.log(`[embedSignatureInPDF] Signature embedded at ${position} position for ${signerName}`);
}

/**
 * Get the signature block positions for the current PDF layout
 * This can be used to adjust positions dynamically if needed
 */
export function getSignaturePositions() {
    return {
        qc: { x: 120, y: 120, label: "品質管制審核" },
        pm: { x: 420, y: 120, label: "專案經理核定" }
    };
}
