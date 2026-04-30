-- CreateTable
CREATE TABLE "CanonicalBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "betType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "line" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanonicalBet_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "externalId" TEXT,
    "currentOdds" REAL NOT NULL,
    "liquidityDepth" REAL NOT NULL,
    "liquidityLevels" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canonicalBetId" TEXT,
    CONSTRAINT "Outcome_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Outcome_canonicalBetId_fkey" FOREIGN KEY ("canonicalBetId") REFERENCES "CanonicalBet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Outcome" ("currentOdds", "externalId", "id", "label", "lastUpdated", "liquidityDepth", "liquidityLevels", "marketId") SELECT "currentOdds", "externalId", "id", "label", "lastUpdated", "liquidityDepth", "liquidityLevels", "marketId" FROM "Outcome";
DROP TABLE "Outcome";
ALTER TABLE "new_Outcome" RENAME TO "Outcome";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalBet_eventId_key_key" ON "CanonicalBet"("eventId", "key");
