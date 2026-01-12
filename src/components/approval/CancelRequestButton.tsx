"use client";

import { useState } from "react";
import { cancelRejectedRequest } from "@/actions/approval";

interface CancelRequestButtonProps {
    requestId: number;
    itemTitle: string;
}

export default function CancelRequestButton({ requestId, itemTitle }: CancelRequestButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleCancel = async () => {
        if (!confirm(`確定要取消「${itemTitle}」的申請嗎？此操作無法復原。`)) return;

        setIsLoading(true);
        const result = await cancelRejectedRequest(requestId);

        if (result.error) {
            alert(result.error);
            setIsLoading(false);
        }
        // 成功後頁面會自動 revalidate
    };

    return (
        <button
            onClick={handleCancel}
            disabled={isLoading}
            className="btn btn-outline"
            style={{
                padding: "0.5rem 1rem",
                fontSize: "0.9rem",
                color: "var(--color-danger)",
                borderColor: "var(--color-danger)"
            }}
        >
            {isLoading ? "取消中..." : "取消申請"}
        </button>
    );
}
