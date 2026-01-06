/**
 * Export SQLite data to JSON files for migration to PostgreSQL
 * 
 * Usage: npx ts-node scripts/export-sqlite.ts
 * 
 * This script exports all data from the SQLite database to JSON files
 * in the `migration-data` directory.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportData() {
    console.log('Starting SQLite data export...\n');

    const outputDir = path.join(process.cwd(), 'migration-data');

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export each model
    const models = [
        { name: 'User', query: () => prisma.user.findMany() },
        { name: 'Project', query: () => prisma.project.findMany() },
        { name: 'Item', query: () => prisma.item.findMany() },
        { name: 'ItemRelation', query: () => prisma.itemRelation.findMany() },
        { name: 'ChangeRequest', query: () => prisma.changeRequest.findMany() },
        { name: 'ItemHistory', query: () => prisma.itemHistory.findMany() },
        { name: 'QCDocumentApproval', query: () => prisma.qCDocumentApproval.findMany() },
        { name: 'DataFile', query: () => prisma.dataFile.findMany() },
        { name: 'DataFileChangeRequest', query: () => prisma.dataFileChangeRequest.findMany() },
        { name: 'DataFileHistory', query: () => prisma.dataFileHistory.findMany() },
    ];

    for (const model of models) {
        try {
            console.log(`Exporting ${model.name}...`);
            const data = await model.query();
            const filePath = path.join(outputDir, `${model.name}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`  ✓ ${data.length} records exported to ${model.name}.json`);
        } catch (error) {
            console.error(`  ✗ Error exporting ${model.name}:`, error.message);
        }
    }

    console.log('\n✓ Export completed! Files saved to:', outputDir);
}

exportData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
