import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const username = "admin";
    const password = "adminpassword"; // Strong password in production
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { username },
        update: {},
        create: {
            username,
            password: hashedPassword,
            role: "ADMIN",
        },
    });

    console.log(`User ${user.username} created/updated with role ${user.role}`);
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
