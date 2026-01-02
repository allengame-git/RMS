import { prisma } from "../src/lib/prisma";
import { generateNextItemId } from "../src/lib/item-utils";

async function main() {
    console.log("Starting Auto-Numbering Verification...");

    // 1. Setup Data
    // Create a Project
    const project = await prisma.project.create({
        data: {
            title: "Numbering Test Project",
            codePrefix: "NUM",
            description: "For testing numbering",
        },
    });
    console.log("Created Project:", project.codePrefix);

    // 2. Test Root Item 1
    const id1 = await generateNextItemId(project.id, null);
    console.log("Expected NUM-1, Got:", id1);
    const item1 = await prisma.item.create({
        data: {
            title: "Root 1",
            fullId: id1,
            projectId: project.id,
            parentId: null,
        }
    });

    // 3. Test Root Item 2
    const id2 = await generateNextItemId(project.id, null);
    console.log("Expected NUM-2, Got:", id2);
    const item2 = await prisma.item.create({
        data: {
            title: "Root 2",
            fullId: id2,
            projectId: project.id,
            parentId: null,
        }
    });

    // 4. Test Child 1.1 (Under Root 1)
    const id1_1 = await generateNextItemId(project.id, item1.id);
    console.log("Expected NUM-1-1, Got:", id1_1);
    const item1_1 = await prisma.item.create({
        data: {
            title: "Child 1.1",
            fullId: id1_1,
            projectId: project.id,
            parentId: item1.id,
        }
    });

    // 5. Test Child 1.2
    const id1_2 = await generateNextItemId(project.id, item1.id);
    console.log("Expected NUM-1-2, Got:", id1_2);
    await prisma.item.create({
        data: {
            title: "Child 1.2",
            fullId: id1_2,
            projectId: project.id,
            parentId: item1.id,
        }
    });

    // 6. Test Grandchild 1.1.1
    const id1_1_1 = await generateNextItemId(project.id, item1_1.id);
    console.log("Expected NUM-1-1-1, Got:", id1_1_1);


    // Cleanup
    await prisma.item.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });

    // Assertions (Simple text check)
    if (id1 === "NUM-1" && id2 === "NUM-2" && id1_1 === "NUM-1-1" && id1_2 === "NUM-1-2" && id1_1_1 === "NUM-1-1-1") {
        console.log("✅ VERIFICATION SUCCESSFUL");
    } else {
        console.error("❌ VERIFICATION FAILED");
        process.exit(1);
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
