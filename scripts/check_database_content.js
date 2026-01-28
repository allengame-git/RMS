const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const userCount = await prisma.user.count();
        const projectCount = await prisma.project.count();
        const itemCount = await prisma.item.count();
        console.log(JSON.stringify({ userCount, projectCount, itemCount }));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
