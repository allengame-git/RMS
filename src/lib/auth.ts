/**
 * @file auth.ts
 * @description NextAuth.js 認證配置模組
 *
 * 此模組定義了 RMS 系統的使用者認證邏輯，使用 Credentials Provider。
 *
 * ## 認證流程
 * 1. 使用者輸入帳號密碼
 * 2. 系統驗證帳號存在性
 * 3. 檢查帳號鎖定狀態
 * 4. 驗證密碼（bcrypt）
 * 5. 成功則發放 JWT Token
 *
 * ## 安全機制
 * ### 帳號鎖定 (Account Lockout)
 * - 連續 5 次密碼錯誤 → 鎖定 15 分鐘
 * - 成功登入後重置錯誤次數
 *
 * ### 登入日誌 (LoginLog)
 * 記錄每次登入嘗試，包含：
 * - IP 地址、User Agent
 * - 成功/失敗狀態
 * - 失敗原因
 *
 * ## Session 結構
 * JWT Token 包含以下使用者資訊：
 * - `id`：使用者 ID
 * - `username`：使用者名稱
 * - `role`：角色（VIEWER/EDITOR/INSPECTOR/ADMIN）
 * - `isQC`：QC 資格
 * - `isPM`：PM 資格
 *
 * @see /src/types/next-auth.d.ts - Session 類型擴展
 * @see /src/actions/users.ts - 使用者管理
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

// Account lockout configuration
const LOCKOUT_CONFIG = {
    maxAttempts: 5,
    lockoutMinutes: 15,
};

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/auth/login",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const username = credentials.username;

                // Find user
                const user = await prisma.user.findUnique({
                    where: { username },
                });

                // Get request info for logging
                const ipAddress = req?.headers?.["x-forwarded-for"] as string ||
                    req?.headers?.["x-real-ip"] as string ||
                    "unknown";
                const userAgent = req?.headers?.["user-agent"] as string || "unknown";

                // Helper to log login attempt
                const logAttempt = async (success: boolean, failReason?: string) => {
                    try {
                        await prisma.loginLog.create({
                            data: {
                                username,
                                success,
                                userId: success && user ? user.id : null,
                                ipAddress: ipAddress.substring(0, 45), // Limit length
                                userAgent: userAgent.substring(0, 255), // Limit length
                                failReason,
                            },
                        });
                    } catch (e) {
                        console.error("[auth] Failed to log login attempt:", e);
                    }
                };

                // User not found
                if (!user) {
                    await logAttempt(false, "USER_NOT_FOUND");
                    return null;
                }

                // Check if account is locked
                if (user.lockedUntil && user.lockedUntil > new Date()) {
                    const remainingMinutes = Math.ceil(
                        (user.lockedUntil.getTime() - Date.now()) / 60000
                    );
                    await logAttempt(false, `ACCOUNT_LOCKED (${remainingMinutes} min remaining)`);
                    throw new Error(`帳號已鎖定，請於 ${remainingMinutes} 分鐘後再試`);
                }

                // Verify password
                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                );

                if (!isPasswordValid) {
                    // 若鎖定已過期，重置計數器後再遞增（防止永久鎖定）
                    const baseAttempts = (user.lockedUntil && user.lockedUntil <= new Date()) ? 0 : user.failedLoginAttempts;
                    const newAttempts = baseAttempts + 1;
                    const shouldLock = newAttempts >= LOCKOUT_CONFIG.maxAttempts;

                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            failedLoginAttempts: newAttempts,
                            lockedUntil: shouldLock
                                ? new Date(Date.now() + LOCKOUT_CONFIG.lockoutMinutes * 60000)
                                : null,
                        },
                    });

                    if (shouldLock) {
                        await logAttempt(false, `INVALID_PASSWORD (account now locked)`);
                        throw new Error(`密碼錯誤次數過多，帳號已鎖定 ${LOCKOUT_CONFIG.lockoutMinutes} 分鐘`);
                    }

                    await logAttempt(false, `INVALID_PASSWORD (attempt ${newAttempts}/${LOCKOUT_CONFIG.maxAttempts})`);
                    return null;
                }

                // Login successful - reset failed attempts
                if (user.failedLoginAttempts > 0 || user.lockedUntil) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            failedLoginAttempts: 0,
                            lockedUntil: null,
                        },
                    });
                }

                await logAttempt(true);

                return {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    isPM: user.isPM,
                    isQC: user.isQC,
                };
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token && session?.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.username = token.username as string;
                session.user.isPM = token.isPM as boolean;
                session.user.isQC = token.isQC as boolean;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.username = user.username;
                token.isPM = user.isPM;
                token.isQC = user.isQC;
            }
            return token;
        },
    },
};
