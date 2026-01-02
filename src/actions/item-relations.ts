'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function addRelatedItem(sourceItemId: number, targetFullId: string) {
    try {
        // 1. Validate target item
        const targetItem = await prisma.item.findUnique({
            where: { fullId: targetFullId }
        });

        if (!targetItem) {
            return { success: false, error: `Item ${targetFullId} not found` };
        }

        if (targetItem.id === sourceItemId) {
            return { success: false, error: 'Cannot relate item to itself' };
        }

        // 2. Check if already related
        const sourceItem = await prisma.item.findUnique({
            where: { id: sourceItemId },
            include: { relatedItems: true }
        });

        if (!sourceItem) {
            return { success: false, error: 'Source item not found' };
        }

        const isAlreadyRelated = sourceItem.relatedItems.some(item => item.id === targetItem.id);
        if (isAlreadyRelated) {
            return { success: false, error: `Item ${targetFullId} is already related` };
        }

        // 3. Create relation (bidirectional?)
        // Prisma self-relation is one-sided by default unless specified otherwise in update
        // But usually related items are symmetric. Let's assume we update both sides for symmetry or just one.
        // The schema assumes symmetric implicit many-to-many? No, implicit m-n are not strictly symmetric in the sense that A->B doesn't mean B->A automatically in terms of "my related items".
        // Wait, implicit m-n uses a join table. A relates to B.
        // If we want symmetry (A related to B implies B related to A), we should probably add to both?
        // Let's stick to simple relation first: A declares B is related.

        await prisma.item.update({
            where: { id: sourceItemId },
            data: {
                relatedItems: {
                    connect: { id: targetItem.id }
                }
            }
        });

        // Also connect the other way to ensure symmetry? 
        // Usually "Related Items" are bidirectional.
        await prisma.item.update({
            where: { id: targetItem.id },
            data: {
                relatedItems: {
                    connect: { id: sourceItemId }
                }
            }
        });

        revalidatePath(`/items/${sourceItemId}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to add related item:', error);
        return { success: false, error: 'Failed to add related item' };
    }
}

export async function removeRelatedItem(sourceItemId: number, targetItemId: number) {
    try {
        // Disconnect both ways for symmetry
        await prisma.item.update({
            where: { id: sourceItemId },
            data: {
                relatedItems: {
                    disconnect: { id: targetItemId }
                }
            }
        });

        await prisma.item.update({
            where: { id: targetItemId },
            data: {
                relatedItems: {
                    disconnect: { id: sourceItemId }
                }
            }
        });

        revalidatePath(`/items/${sourceItemId}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to remove related item:', error);
        return { success: false, error: 'Failed to remove related item' };
    }
}
