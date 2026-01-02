"use client";

import { useState } from "react";
import { submitDeleteItemRequest } from "@/actions/approval";

interface DeleteItemButtonProps {
    itemId: number;
    childCount: number;
    isDisabled?: boolean;
}

export default function DeleteItemButton({ itemId, childCount, isDisabled = false }: DeleteItemButtonProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to request deletion of this item? This action requires approval.")) return;

        setIsSubmitting(true);
        try {
            const result = await submitDeleteItemRequest(itemId);
            if (result.error) {
                alert(result.error);
            } else {
                alert(result.message);
                // Optionally refresh logic handled by parent via revalidatePath
            }
        } catch (err) {
            alert("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (childCount > 0) {
        return (
            <div title="Cannot delete item with children" style={{ display: 'inline-block' }}>
                <button
                    className="btn"
                    disabled
                    style={{
                        opacity: 0.5,
                        cursor: 'not-allowed',
                        color: 'var(--color-danger)',
                        borderColor: 'var(--color-danger)',
                        background: 'transparent',
                        border: '1px solid var(--color-danger)',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)'
                    }}
                >
                    Delete (Has Children)
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDisabled || isSubmitting}
            title={isDisabled ? "Changes pending approval" : "Request deletion"}
            style={{
                color: 'var(--color-danger)',
                borderColor: 'var(--color-danger)',
                background: 'transparent',
                border: '1px solid var(--color-danger)',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                cursor: (isDisabled || isSubmitting) ? 'not-allowed' : 'pointer',
                opacity: (isDisabled || isSubmitting) ? 0.5 : 1
            }}
        >
            {isSubmitting ? "Requesting..." : "Delete"}
        </button>
    );
}
