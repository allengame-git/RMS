"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

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
    if (password.length < 6) return { error: "Password must be at least 6 characters" };

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
        if (data.password.length < 6) return { error: "Password must be at least 6 characters" };
        updates.password = await bcrypt.hash(data.password, 10);
    }

    // 3. Handle Role Update
    if (data.role) {
        // Valid roles: VIEWER, EDITOR, INSPECTOR, ADMIN
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

    // 1. ChangeRequest - submitter
    await prisma.changeRequest.updateMany({
        where: { submittedById: userId },
        data: { submitterName: username }
    });

    // 2. ChangeRequest - reviewer
    await prisma.changeRequest.updateMany({
        where: { reviewedById: userId },
        data: { reviewerName: username }
    });

    // 3. ItemHistory - submitter
    await prisma.itemHistory.updateMany({
        where: { submittedById: userId },
        data: { submitterName: username }
    });

    // 4. ItemHistory - reviewer
    await prisma.itemHistory.updateMany({
        where: { reviewedById: userId },
        data: { reviewerName: username }
    });

    // 5. DataFileChangeRequest - submitter
    await prisma.dataFileChangeRequest.updateMany({
        where: { submittedById: userId },
        data: { submitterName: username }
    });

    // 6. DataFileChangeRequest - reviewer
    await prisma.dataFileChangeRequest.updateMany({
        where: { reviewedById: userId },
        data: { reviewerName: username }
    });

    // 7. DataFileHistory - submitter
    await prisma.dataFileHistory.updateMany({
        where: { submittedById: userId },
        data: { submitterName: username }
    });

    // 8. DataFileHistory - reviewer
    await prisma.dataFileHistory.updateMany({
        where: { reviewedById: userId },
        data: { reviewerName: username }
    });

    // 9. QCDocumentApproval - QC approver
    await prisma.qCDocumentApproval.updateMany({
        where: { qcApprovedById: userId },
        data: { qcApproverName: username }
    });

    // 10. QCDocumentApproval - PM approver
    await prisma.qCDocumentApproval.updateMany({
        where: { pmApprovedById: userId },
        data: { pmApproverName: username }
    });

    // Now delete the user - FK fields will be set to null by onDelete: SetNull
    await prisma.user.delete({
        where: { id: userId },
    });

    revalidatePath("/admin/users");
}
