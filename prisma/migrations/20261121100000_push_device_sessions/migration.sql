-- Cihaz kaydını, kaydı yapan oturuma bağla: oturum biterse (çıkış, süre dolması, şifre değişikliği)
-- bildirim kaydı da silinir — süresi dolmuş bir telefon o hesabın bildirimlerini almaya devam etmesin.
-- AlterTable
ALTER TABLE `push_devices` ADD COLUMN `sessionId` VARCHAR(191) NULL,
    ADD COLUMN `clientSessionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `push_devices_sessionId_idx` ON `push_devices`(`sessionId`);

-- CreateIndex
CREATE INDEX `push_devices_clientSessionId_idx` ON `push_devices`(`clientSessionId`);

-- AddForeignKey
ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_clientSessionId_fkey` FOREIGN KEY (`clientSessionId`) REFERENCES `client_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
