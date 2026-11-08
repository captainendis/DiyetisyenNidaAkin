-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMPTZ(3),
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "variantNote" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");

-- CreateIndex
CREATE INDEX "recipes_isPublished_idx" ON "recipes"("isPublished");

-- CreateIndex
CREATE INDEX "recipes_parentId_idx" ON "recipes"("parentId");

-- CreateIndex
CREATE INDEX "recipes_clientId_idx" ON "recipes"("clientId");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

