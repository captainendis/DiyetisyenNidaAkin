-- Mağaza incelemesi rolü: salt okunur, yalnızca demo danışanları görür (server/auth/reviewer.ts)
-- AlterTable
ALTER TABLE `roles` MODIFY `key` ENUM('ADMIN', 'DIETITIAN', 'ASSISTANT', 'REVIEWER') NOT NULL;

-- AlterTable
ALTER TABLE `clients` ADD COLUMN `isDemo` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `clients_isDemo_idx` ON `clients`(`isDemo`);

-- Rol kaydı (seed çalıştırılmayan kurulumlar için); izinler server/auth/permissions.ts → ROLE_PERMISSIONS.REVIEWER ile aynı
INSERT INTO `roles` (`id`, `key`, `name`, `permissions`)
VALUES ('role_reviewer', 'REVIEWER', 'İnceleme', JSON_ARRAY('dashboard:read', 'appointments:read', 'clients:read', 'clinical:read'))
ON DUPLICATE KEY UPDATE `permissions` = VALUES(`permissions`);
