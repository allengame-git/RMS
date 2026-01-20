"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password-policy";

export type UserState = {
    message?: string;
    error?: string;
};

// --- GET USERS ---
export async function getUsers() {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized");
    }

    return await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            role: true,
            isQC: true,
            isPM: true,
            signaturePath: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
}

// --- CREATE USER ---
export async function createUser(prevState: UserState, formData: FormData): Promise<UserState> {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return { error: "Unauthorized" };
    }

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string;

    if (!username || !password || !role) {
        return { error: "Missing required fields" };
    }

    if (username.length < 2) return { error: "Username must be at least 2 characters" };

    // Validate password against policy
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return { error: passwordValidation.errors.join('、') };
    }

    const isQC = formData.get("isQC") === "true";
    const isPM = formData.get("isPM") === "true";
    const signaturePath = formData.get("signaturePath") as string;

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return { error: "Username already exists" };

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role,
                isQC,
                isPM,
                signaturePath: signaturePath || null,
            },
        });
        revalidatePath("/admin/users");
        return { message: "User created successfully" };
    } catch (e) {
        console.error(e);
        return { error: "Failed to create user" };
    }
}

// --- UPDATE USER (Comprehensive) ---
export async function updateUser(
    userId: string,
    data: {
        username?: string;
        password?: string;
        role?: string;
        isQC?: boolean;
        isPM?: boolean;
        signaturePath?: string;
    }
): Promise<UserState> {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

    const updates: any = {};

    // 1. Handle Username Update
    if (data.username) {
        if (data.username.length < 2) return { error: "Username must be at least 2 characters" };

        // Check uniqueness excluding self
        const existing = await prisma.user.findFirst({
            where: {
                username: data.username,
                NOT: { id: userId }
            }
        });
        if (existing) return { error: "Username already taken" };
        updates.username = data.username;
    }

    // 2. Handle Password Update (Reset)
    if (data.password) {
        const passwordValidation = validatePassword(data.password);
        if (!passwordValidation.valid) {
            return { error: passwordValidation.errors.join('、') };
        }
        updates.password = await bcrypt.hash(data.password, 10);
    }

    // 3. Handle Role Update (with validation)
    if (data.role) {
        const VALID_ROLES = ['VIEWER', 'EDITOR', 'INSPECTOR', 'ADMIN'];
        if (!VALID_ROLES.includes(data.role)) {
            return { error: '無效的角色' };
        }
        updates.role = data.role;
    }

    // 4. Handle Qualifications
    if (data.isQC !== undefined) updates.isQC = data.isQC;
    if (data.isPM !== undefined) updates.isPM = data.isPM;
    if (data.signaturePath !== undefined) updates.signaturePath = data.signaturePath;

    if (Object.keys(updates).length === 0) return { message: "No changes made" };

    try {
        await prisma.user.update({
            where: { id: userId },
            data: updates,
        });
        revalidatePath("/admin/users");
        return { message: "User updated successfully" };
    } catch (e) {
        console.error(e);
        return { error: "Failed to update user" };
    }
}

// --- DELETE USER ---
export async function deleteUser(userId: string) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

    if (userId === session.user.id) throw new Error("Cannot delete yourself");

    // Get user info before deletion
    const userToDelete = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true }
    });

    if (!userToDelete) throw new Error("User not found");

    const username = userToDelete.username;

    // Update all related records with the username before deletion
    // This preserves the username in the redundant fields when the FK is set to null
    // Use transaction for atomicity
    await prisma.$transaction([
        // 1. ChangeRequest - submitter
        prisma.changeRequest.updateMany({
            where: { submittedById: userId },
            data: { submitterName: username }
        }),
        // 2. ChangeRequest - reviewer
        prisma.changeRequest.updateMany({
            where: { reviewedById: userId },
            data: { reviewerName: username }
        }),
        // 3. ItemHistory - submitter
        prisma.itemHistory.updateMany({
            where: { submittedById: userId },
            data: { submitterName: username }
        }),
        // 4. ItemHistory - reviewer
        prisma.itemHistory.updateMany({
            where: { reviewedById: userId },
            data: { reviewerName: username }
        }),
        // 5. DataFileChangeRequest - submitter
        prisma.dataFileChangeRequest.updateMany({
            where: { submittedById: userId },
            data: { submitterName: username }
        }),
        // 6. DataFileChangeRequest - reviewer
        prisma.dataFileChangeRequest.updateMany({
            where: { reviewedById: userId },
            data: { reviewerName: username }
        }),
        // 7. DataFileHistory - submitter
        prisma.dataFileHistory.updateMany({
            where: { submittedById: userId },
            data: { submitterName: username }
        }),
        // 8. DataFileHistory - reviewer
        prisma.dataFileHistory.updateMany({
            where: { reviewedById: userId },
            data: { reviewerName: username }
        }),
        // 9. QCDocumentApproval - QC approver
        prisma.qCDocumentApproval.updateMany({
            where: { qcApprovedById: userId },
            data: { qcApproverName: username }
        }),
        // 10. QCDocumentApproval - PM approver
        prisma.qCDocumentApproval.updateMany({
            where: { pmApprovedById: userId },
            data: { pmApproverName: username }
        }),
        // 11. Delete the user - FK fields will be set to null by onDelete: SetNull
        prisma.user.delete({
            where: { id: userId },
        }),
    ]);

    revalidatePath("/admin/users");
}

// --- UNLOCK USER (Admin) ---
export async function unlockUser(userId: string): Promise<UserState> {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return { error: "Unauthorized" };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
        revalidatePath("/admin/users");
        return { message: "帳號已解鎖" };
    } catch (e) {
        console.error(e);
        return { error: "解鎖失敗" };
    }
}

// --- GET USERS WITH LOCK STATUS ---
export async function getUsersWithLockStatus() {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized");
    }

    return await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            role: true,
            isQC: true,
            isPM: true,
            signaturePath: true,
            createdAt: true,
            failedLoginAttempts: true,
            lockedUntil: true,
        },
        orderBy: { createdAt: "desc" },
    });
}
