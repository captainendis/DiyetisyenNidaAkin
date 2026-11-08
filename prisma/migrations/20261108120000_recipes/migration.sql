-- CreateEnum
CREATE TYPE "RecipeCategory" AS ENUM ('BREAKFAST', 'SNACK', 'MAIN', 'SOUP', 'SALAD', 'DESSERT', 'DRINK');

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "RecipeCategory" NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "servings" INTEGER,
    "prepMinutes" INTEGER,
    "cookMinutes" INTEGER,
    "kcal" INTEGER,
    "ingredients" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "tip" TEXT NOT NULL DEFAULT '',
    "imageBase" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipes_category_idx" ON "recipes"("category");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

