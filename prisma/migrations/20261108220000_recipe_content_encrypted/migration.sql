-- Tarif içeriği (ad, kısa açıklama, malzemeler, adımlar, ipucu) artık tek bir şifreli alanda: "contentEnc"
-- (AES-256-GCM, DATA_ENCRYPTION_KEY). Şifreleme anahtarı yalnızca uygulamada olduğu için mevcut satırların
-- taşınması uygulama açılışında yapılır (server/services/recipe-content.ts → encryptLegacyRecipeContent).
--
-- Düz metin sütunları burada YALNIZCA taşınmamış satır yoksa silinir (yeni/boş kurulum). Aksi hâlde veri
-- kaybı olmasın diye bırakılır: uygulama açılışta içerikleri şifreleyip sütunları kendisi kaldırır.
-- Bu arada yeni kayıtlar eski sütunlara değer yazmadığı için "title" zorunluluğu kaldırılır.
ALTER TABLE "recipes" ADD COLUMN "contentEnc" TEXT;
ALTER TABLE "recipes" ALTER COLUMN "title" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "recipes" WHERE "contentEnc" IS NULL) THEN
    ALTER TABLE "recipes"
      DROP COLUMN "title",
      DROP COLUMN "summary",
      DROP COLUMN "ingredients",
      DROP COLUMN "steps",
      DROP COLUMN "tip";
  END IF;
END $$;
