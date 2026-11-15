-- CreateTable
CREATE TABLE `class_group_notes` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `kind` ENUM('DONE', 'PLANNED') NOT NULL DEFAULT 'DONE',
    `noteDate` VARCHAR(10) NULL,
    `bodyEnc` TEXT NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `class_group_notes_groupId_createdAt_idx`(`groupId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- AddForeignKey
ALTER TABLE `class_group_notes` ADD CONSTRAINT `class_group_notes_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `class_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `class_group_notes` ADD CONSTRAINT `class_group_notes_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
