-- Onaylanmış / tamamlanmış randevuların zaman aralıkları çakışamaz.
-- Uygulama katmanındaki (advisory lock + transaction) kontrolün yanında son savunma hattıdır.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap_confirmed"
  EXCLUDE USING gist (tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" IN ('CONFIRMED', 'COMPLETED') AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL);

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_order" CHECK ("startsAt" IS NULL OR "endsAt" > "startsAt");
