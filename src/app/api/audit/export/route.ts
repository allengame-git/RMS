import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exportDailyLoginLogs } from "@/actions/audit";

/**
 * GET /api/audit/export
 * Export login audit logs for a specific date
 * Query params:
 *   - date: YYYY-MM-DD format (optional, defaults to yesterday)
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
