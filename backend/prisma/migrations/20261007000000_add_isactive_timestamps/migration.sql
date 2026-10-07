-- AlterTable: Department — add isActive, createdAt, updatedAt
ALTER TABLE "Department"
  ADD COLUMN "isActive"  BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Doctor — add isActive, createdAt, updatedAt
ALTER TABLE "Doctor"
  ADD COLUMN "isActive"  BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: isActive on Department
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex: isActive on Doctor
CREATE INDEX "Doctor_isActive_idx" ON "Doctor"("isActive");

-- Case-insensitive uniqueness on Department name
-- (The existing Department_name_key index enforces exact-case uniqueness;
--  this additional index enforces case-insensitive uniqueness.)
CREATE UNIQUE INDEX IF NOT EXISTS "UX_department_name_lower" ON "Department" (LOWER(name));
