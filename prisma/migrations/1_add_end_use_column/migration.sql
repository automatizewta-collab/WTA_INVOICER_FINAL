-- AlterTable: documents
ALTER TABLE `documents` ADD COLUMN `show_end_use_column` BOOLEAN NOT NULL DEFAULT FALSE AFTER `show_sterile_column`;
