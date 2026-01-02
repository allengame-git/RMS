-- CreateTable
CREATE TABLE "_ItemRelations" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ItemRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ItemRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_ItemRelations_AB_unique" ON "_ItemRelations"("A", "B");

-- CreateIndex
CREATE INDEX "_ItemRelations_B_index" ON "_ItemRelations"("B");
