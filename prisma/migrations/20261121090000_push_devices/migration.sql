-- Mobil anlık bildirim (Expo push) cihaz token'ları: sahibi personel kullanıcısı YA DA danışan hesabı.
-- "Tam olarak bir sahip" kuralı uygulamada (server/services/push.ts) uygulanır: MySQL/MariaDB, CASCADE'li
-- yabancı anahtar sütunlarını CHECK kısıtında kabul etmez.
-- CreateTable
CREATE TABLE `push_devices` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `platform` ENUM('IOS', 'ANDROID') NOT NULL,
    `userId` VARCHAR(191) NULL,
    `clientAccountId` VARCHAR(191) NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `push_devices_token_key`(`token`),
    INDEX `push_devices_userId_idx`(`userId`),
    INDEX `push_devices_clientAccountId_idx`(`clientAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_clientAccountId_fkey` FOREIGN KEY (`clientAccountId`) REFERENCES `client_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
