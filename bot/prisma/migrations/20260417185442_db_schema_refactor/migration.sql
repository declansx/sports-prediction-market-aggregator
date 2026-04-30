/*
  Warnings:

  - You are about to drop the column `league` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `sport` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `platform` on the `Outcome` table. All the data in the column will be lost.
  - Added the required column `eventId` to the `Market` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sxEventId" TEXT,
    "polyEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TeamAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonical" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "league" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "betType" TEXT NOT NULL DEFAULT '1x2',
    "line" REAL,
    "mainLine" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Market_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Market" ("betType", "createdAt", "externalId", "id", "line", "mainLine", "platform", "startTime", "status") SELECT "betType", "createdAt", "externalId", "id", "line", "mainLine", "platform", "startTime", "status" FROM "Market";
DROP TABLE "Market";
ALTER TABLE "new_Market" RENAME TO "Market";
CREATE UNIQUE INDEX "Market_platform_externalId_key" ON "Market"("platform", "externalId");
CREATE TABLE "new_Outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "externalId" TEXT,
    "currentOdds" REAL NOT NULL,
    "liquidityDepth" REAL NOT NULL,
    "liquidityLevels" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Outcome_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Outcome" ("currentOdds", "externalId", "id", "label", "lastUpdated", "liquidityDepth", "liquidityLevels", "marketId") SELECT "currentOdds", "externalId", "id", "label", "lastUpdated", "liquidityDepth", "liquidityLevels", "marketId" FROM "Outcome";
DROP TABLE "Outcome";
ALTER TABLE "new_Outcome" RENAME TO "Outcome";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Event_league_homeTeam_awayTeam_startTime_key" ON "Event"("league", "homeTeam", "awayTeam", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAlias_platform_alias_league_key" ON "TeamAlias"("platform", "alias", "league");
