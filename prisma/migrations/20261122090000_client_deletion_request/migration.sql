-- Danışanın uygulama içinden hesap ve veri silme talebi
-- AlterTable
ALTER TABLE `client_accounts` ADD COLUMN `deletionRequestedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('APPOINTMENT_REQUESTED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_UPCOMING', 'CLIENT_CREATED', 'CLIENT_DELETION_REQUESTED') NOT NULL;
