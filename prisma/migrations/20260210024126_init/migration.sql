-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "hash" TEXT,
    "mtime" DATETIME,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FileRecord_path_key" ON "FileRecord"("path");

-- CreateIndex
CREATE INDEX "FileRecord_size_idx" ON "FileRecord"("size");

-- CreateIndex
CREATE INDEX "FileRecord_hash_idx" ON "FileRecord"("hash");
