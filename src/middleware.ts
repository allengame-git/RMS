/**
 * @file middleware.ts
 * @description Next.js 邊緣層路由保護
 *
 * 使用 NextAuth.js 的 JWT 驗證，在邊緣層攔截未認證的請求。
 * 未登入使用者會被重導向至登入頁面。
 *
 * ## 排除路由
 * - /auth/login：登入頁面
 * - /api/auth：NextAuth 認證 API
 * - /api/health：健康檢查端點
 * - /_next：Next.js 靜態資源
 * - /favicon.ico：網站圖示
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
    const token = await getToken({ req: request });

    if (!token) {
        const loginUrl = new URL("/auth/login", request.url);
        loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * 匹配所有路由，排除：
         * - /auth/login (登入頁面)
         * - /api/auth (NextAuth API)
         * - /api/health (健康檢查)
         * - /api/admin/restore (還原 API，檔案可能超過 middleware 10MB 限制，路由內部有 ADMIN 權限檢查)
         * - /api/datafiles/upload (檔案上傳，最大 100MB，超過 middleware 10MB 限制，路由內部有權限檢查)
         * - /api/upload (一般上傳，最大 20MB，超過 middleware 10MB 限制，路由內部有權限檢查)
         * - /_next/static (靜態檔案)
         * - /_next/image (圖片最佳化)
         * - /favicon.ico (網站圖示)
         */
        "/((?!auth/login|api/auth|api/health|api/admin/restore|api/datafiles/upload|api/upload|_next/static|_next/image|favicon.ico).*)",
    ],
};
