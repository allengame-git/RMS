/**
 * Import JSON data to PostgreSQL database
 * 
 * Usage: npx ts-node scripts/import-postgres.ts
 * 
 * This script imports data from JSON files in the `migration-data` directory
 * to the PostgreSQL database.
 * 
 * Prerequisites:
 * 1. PostgreSQL database must be running
 * 2. npx prisma migrate dev must have been run
 * 3. migration-data/*.json files must exist (from export-sqlite.js)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importData() {
    console.log('Starting PostgreSQL data import...\n');

    const inputDir = path.join(process.cwd(), 'migration-data');

    if (!fs.existsSync(inputDir)) {
        console.error('Error: migration-data directory not found. Run export-sqlite.js first.');
        process.exit(1);
    }

    // Import order matters due to foreign key constraints
    const importOrder = [
        { name: 'User', model: 'user' },
        { name: 'Project', model: 'project' },
        { name: 'Item', model: 'item' },
        { name: 'ItemRelation', model: 'itemRelation' },
        { name: 'ChangeRequest', model: 'changeRequest' },
        { name: 'ItemHistory', model: 'itemHistory' },
        { name: 'QCDocumentApproval', model: 'qCDocumentApproval' },
        { name: 'DataFile', model: 'dataFile' },
        { name: 'DataFileChangeRequest', model: 'dataFileChangeRequest' },
        { name: 'DataFileHistory', model: 'dataFileHistory' },
    ];

    for (const { name, model } of importOrder) {
        const filePath = path.join(inputDir, `${name}.json`);

        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${name}: file not found`);
            continue;
        }

        try {
            console.log(`Importing ${name}...`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            if (data.length === 0) {
                console.log(`  - No records to import`);
                continue;
            }

            // Import each record individually to handle errors gracefully
            let imported = 0;
            let skipped = 0;

            for (const record of data) {
                try {
                    // Convert date strings back to Date objects
                    const processedRecord = processDateFields(record);
                    await prisma[model].create({ data: processedRecord });
                    imported++;
                } catch (err) {
                    skipped++;
                    // Likely duplicate key error, can be ignored
                }
            }

            console.log(`  ✓ ${imported} records imported, ${skipped} skipped`);

            // Reset sequence for auto-increment fields (PostgreSQL specific)
            if ('id' in data[0] && typeof data[0].id === 'number') {
                const maxId = Math.max(...data.map(r => r.id));
                await resetSequence(name, maxId);
                console.log(`  ✓ Sequence reset to ${maxId + 1}`);
            }

        } catch (error) {
            console.error(`  ✗ Error importing ${name}:`, error.message);
        }
    }

    console.log('\n✓ Import completed!');
}

function processDateFields(record) {
    const dateFields = ['createdAt', 'updatedAt', 'publishedAt', 'qcApprovedAt', 'pmApprovedAt'];
    const processed = { ...record };

    for (const field of dateFields) {
        if (processed[field] && typeof processed[field] === 'string') {
            processed[field] = new Date(processed[field]);
        }
    }

    return processed;
}

async function resetSequence(tableName, maxId) {
    const sequenceMap = {
        'Project': 'Project_id_seq',
        'Item': 'Item_id_seq',
        'ItemRelation': 'ItemRelation_id_seq',
        'ChangeRequest': 'ChangeRequest_id_seq',
        'ItemHistory': 'ItemHistory_id_seq',
        'QCDocumentApproval': 'QCDocumentApproval_id_seq',
        'DataFile': 'DataFile_id_seq',
        'DataFileChangeRequest': 'DataFileChangeRequest_id_seq',
        'DataFileHistory': 'DataFileHistory_id_seq',
    };

    const seqName = sequenceMap[tableName];
    if (seqName) {
        try {
            await prisma.$executeRawUnsafe(`SELECT setval('"${seqName}"', ${maxId}, true)`);
        } catch (err) {
            // Sequence might not exist with this exact name, try alternative format
            try {
                await prisma.$executeRawUnsafe(`SELECT setval('"public"."${seqName}"', ${maxId}, true)`);
            } catch {
                console.log(`    (sequence reset skipped - use manual reset if needed)`);
            }
        }
    }
}

importData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
