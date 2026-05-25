import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
        console.error("❌ 請設定環境變數 ADMIN_PASSWORD（至少 12 字元，含大小寫與數字）");
        process.exit(1);
    }

    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        console.error("❌ ADMIN_PASSWORD 強度不足：至少 12 字元，需包含大小寫字母與數字");
        process.exit(1);
    }

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
