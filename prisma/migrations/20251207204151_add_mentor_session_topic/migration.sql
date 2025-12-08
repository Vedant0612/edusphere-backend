/*
  Warnings:

  - The values [PENDING,COMPLETED,CANCELLED] on the enum `MentorSessionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MentorSessionStatus_new" AS ENUM ('scheduled', 'completed', 'cancelled');
ALTER TABLE "mentorSessions" ALTER COLUMN "status" TYPE "MentorSessionStatus_new" USING ("status"::text::"MentorSessionStatus_new");
ALTER TYPE "MentorSessionStatus" RENAME TO "MentorSessionStatus_old";
ALTER TYPE "MentorSessionStatus_new" RENAME TO "MentorSessionStatus";
DROP TYPE "MentorSessionStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "mentorSessions" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "topic" TEXT;
