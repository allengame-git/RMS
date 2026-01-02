import { prisma } from "@/lib/prisma";

/**
 * Generates the next hierarchical ID for an item.
 * Format:
 * - Root: {ProjectCode}-{Seq} (e.g., RMS-1)
 * - Child: {ParentFullId}-{Seq} (e.g., RMS-1-1)
 * 
 * Logic covers gaps? No, typically simpler to just take Max + 1 to avoid reuse confusion, 
 * unless user explicitly requests gap filling. We will use Max + 1.
 */
export async function generateNextItemId(projectId: number, parentId: number | null): Promise<string> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { codePrefix: true }
    });

    if (!project) throw new Error("Project not found");

    let parentFullId = "";
    if (parentId) {
        const parent = await prisma.item.findUnique({
            where: { id: parentId },
            select: { fullId: true }
        });
        if (!parent) throw new Error("Parent item not found");
        parentFullId = parent.fullId;
    }

    // Find all siblings to determine max sequence
    // We search for items that start with the prefix and have the same depth
    // Ideally, we just check items with same parentId.
    const siblings = await prisma.item.findMany({
        where: {
            projectId,
            parentId
        },
        select: { fullId: true }
    });

    let maxSeq = 0;

    // Pattern to extract the last number.
    // If Root (RMS-1), prefix is "RMS-". Match number after that.
    // If Child (RMS-1-1), prefix is "RMS-1-". Match number after that.

    // Construct regex based on expected parent prefix
    // If parentId is null, prefix is "{codePrefix}-" -> Regex: ^{codePrefix}-(\d+)$
    // If parentId is set, prefix is "{parentFullId}-" -> Regex: ^{parentFullId}-(\d+)$

    const prefix = parentId ? `${parentFullId}-` : `${project.codePrefix}-`;

    // We can filter in JS. 
    for (const sib of siblings) {
        if (sib.fullId.startsWith(prefix)) {
            const suffix = sib.fullId.substring(prefix.length);
            // Ensure suffix is just a number (no extra hyphens, though query filtered by parentId so it should be immediate siblings)
            // But wait, if data is corrupted or mixed, good to be safe.
            // With parentId check, these ARE the direct siblings.
            const seq = parseInt(suffix, 10);
            if (!isNaN(seq)) {
                if (seq > maxSeq) maxSeq = seq;
            }
        }
    }

    return `${prefix}${maxSeq + 1}`;
}
