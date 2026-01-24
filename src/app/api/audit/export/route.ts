import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exportDailyLoginLogs } from "@/actions/audit";

/**
 * @file route.ts (api/audit/export)
 * @description 管理員 - 登入稽核日誌匯出 API 路由
 *
 * 將指定日期的使用者登入事件匯出為 CSV 格式檔案，供安全性審核使用。
 *
 * ## 核心功能
 * - 輸入: `date` (YYYY-MM-DD 格式，選填，預設為昨天)
 * - 驗證管理員身份
 * - 調用 `exportDailyLoginLogs` Server Action
 * - 回傳成功訊息與生成的檔案路徑
 *
 * @see /src/actions/audit.ts - 匯出實作
 */
export async function GET(request: NextRequest) {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json(
            { error: "Unauthorized: Admin access required" },
            { status: 401 }
        );
    }

    try {
        // Parse date from query params
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get("date");

        let targetDate: Date | undefined;
        if (dateParam) {
            // Validate date format YYYY-MM-DD
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
                return NextResponse.json(
                    { error: "Invalid date format. Use YYYY-MM-DD" },
                    { status: 400 }
                );
            }
            targetDate = new Date(dateParam + "T00:00:00.000Z");

            // Check if date is valid
            if (isNaN(targetDate.getTime())) {
                return NextResponse.json(
                    { error: "Invalid date" },
                    { status: 400 }
                );
            }
        }

        // Export logs
        const result = await exportDailyLoginLogs(targetDate);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Exported ${result.recordCount} login records`,
            filePath: result.filePath,
            recordCount: result.recordCount
        });
    } catch (error) {
        console.error("[API/audit/export] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
