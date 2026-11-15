-- Danışan cinsiyeti: vücut kompozisyonu (yağ oranı) tahmini için, isteğe bağlı
ALTER TABLE `clients` ADD COLUMN `sex` ENUM('FEMALE', 'MALE') NULL;
