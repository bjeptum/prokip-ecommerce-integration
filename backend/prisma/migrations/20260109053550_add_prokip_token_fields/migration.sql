-- AlterTable
ALTER TABLE "prokip_config" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "userId" INTEGER NOT NULL DEFAULT 1;
