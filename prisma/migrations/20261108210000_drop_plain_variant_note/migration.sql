-- Eski düz metin varyasyon notu sütununu kaldır.
-- Notlar 20261108200000 sürümünden beri şifreli sütunda (variantNoteEnc) tutuluyor; düz metinden şifreliye
-- taşıma ise anahtar yalnızca uygulamada olduğu için uygulama açılışında yapılıyor. Sunucu o sürümü hiç
-- çalıştırmadan doğrudan buraya geçerse sütunda hâlâ taşınmamış not olabilir: bu durumda sütun BURADA
-- SİLİNMEZ (veri kaybı olmasın), uygulama açılışta notları şifreleyip sütunu kendisi kaldırır
-- (server/services/recipe-notes.ts → encryptLegacyVariantNotes).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'recipes' AND column_name = 'variantNote'
  ) AND NOT EXISTS (SELECT 1 FROM "recipes" WHERE "variantNote" <> '') THEN
    ALTER TABLE "recipes" DROP COLUMN "variantNote";
  END IF;
END $$;
