/**
 * @file route.ts (api/auth)
 * @description NextAuth.js 認證路由入口
 *
 * 處理所有與身份驗證相關的 HTTP 請求，包括登入、登出、Session 檢查等。
 * 核心配置定義於 `@/lib/auth`。
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
