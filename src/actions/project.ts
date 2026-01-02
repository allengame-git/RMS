"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ProjectState = {
    message?: string;
    error?: string;
};

export async function createProject(prevState: ProjectState, formData: FormData): Promise<ProjectState> {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role === "VIEWER") {
        return { error: "Unauthorized: Only Admins and Editors can create projects." };
    }

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const codePrefix = formData.get("codePrefix") as string;

    if (!title || !codePrefix) {
        return { error: "Title and Code Prefix are required." };
    }

    // Code Prefix format validation (uppercase, alphanumeric)
    if (!/^[A-Z0-9]+$/.test(codePrefix)) {
        return { error: "Code Prefix must be uppercase alphanumeric characters." };
    }

    try {
        await prisma.project.create({
            data: {
                title,
                description,
                codePrefix,
            },
        });

        revalidatePath("/projects");
        return { message: "Project created successfully!" };
    } catch (e: any) {
        if (e.code === 'P2002') { // Prisma unique constraint error
            return { error: "Code Prefix already exists." };
        }
        return { error: "Failed to create project." };
    }
}

export async function deleteProject(id: number) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized: Only Admins can delete projects.");
    }

    await prisma.project.delete({
        where: { id },
    });

    revalidatePath("/projects");
}

export async function getProjects() {
    const projects = await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: { items: true }
            }
        }
    });
    return projects;
}
