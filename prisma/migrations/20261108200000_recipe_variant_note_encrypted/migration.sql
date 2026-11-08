-- Varyasyon notları artık şifreli (variantNoteEnc). Şifreleme anahtarı yalnızca uygulamada olduğu için
-- mevcut düz metin notlar SQL ile değil, uygulama açılışında (encryptLegacyVariantNotes) taşınır ve
-- "variantNote" sütunu boşaltılır. Sütun sonraki bir sürümde kaldırılacak.
-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "variantNoteEnc" TEXT;
