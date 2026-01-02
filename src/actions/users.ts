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

    if (username.length < 3) return { error: "Username must be at least 3 characters" };
    if (password.length < 6) return { error: "Password must be at least 6 characters" };

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return { error: "Username already exists" };

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role,
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
    data: { username?: string; password?: string; role?: string }
): Promise<UserState> {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return { error: "Unauthorized" };

    const updates: any = {};

    // 1. Handle Username Update
    if (data.username) {
        if (data.username.length < 3) return { error: "Username must be at least 3 characters" };

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

    await prisma.user.delete({
        where: { id: userId },
    });
    revalidatePath("/admin/users");
}
