-- Pilates talepleri randevularla aynı akışta: talebin türü ve pilates tercihleri
ALTER TABLE `appointments`
    ADD COLUMN `kind` ENUM('CONSULTATION', 'PILATES') NOT NULL DEFAULT 'CONSULTATION',
    ADD COLUMN `pilatesFormat` ENUM('GROUP', 'PRIVATE') NULL,
    ADD COLUMN `preferredDays` VARCHAR(20) NULL,
    ADD COLUMN `preferredDayparts` VARCHAR(40) NULL;

-- CreateIndex
CREATE INDEX `appointments_kind_idx` ON `appointments`(`kind`);
