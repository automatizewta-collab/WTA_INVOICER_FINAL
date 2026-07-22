-- CreateTable: users
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(191) NOT NULL PRIMARY KEY,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'editor',
    `passwordHash` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `users_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: companies
CREATE TABLE IF NOT EXISTS `companies` (
    `id` VARCHAR(191) NOT NULL PRIMARY KEY,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `contact_name` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `postal_code` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `cnpj` VARCHAR(191) NULL,
    `state_registration` VARCHAR(191) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
    `logo_url` VARCHAR(191) NULL,
    `bank_details` VARCHAR(191) NULL,
    `mid_code` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: items
CREATE TABLE IF NOT EXISTS `items` (
    `id` VARCHAR(191) NOT NULL PRIMARY KEY,
    `code` VARCHAR(191) NOT NULL,
    `name_pt` VARCHAR(191) NOT NULL,
    `name_en` VARCHAR(191) NOT NULL,
    `name_es` VARCHAR(191) NULL,
    `unit_value_usd` DOUBLE NOT NULL,
    `gross_weight` DOUBLE NOT NULL,
    `net_weight` DOUBLE NOT NULL,
    `htsus_code` VARCHAR(191) NULL,
    `end_use` VARCHAR(191) NULL,
    `end_use_es` VARCHAR(191) NULL,
    `sterile_at_import` VARCHAR(191) NOT NULL DEFAULT 'NO',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: documents
CREATE TABLE IF NOT EXISTS `documents` (
    `id` VARCHAR(191) NOT NULL PRIMARY KEY,
    `document_type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `number` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `sender_id` VARCHAR(191) NOT NULL,
    `recipient_id` VARCHAR(191) NULL,
    `items` JSON NOT NULL,
    `dollar_exchange_rate` DOUBLE NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `htsus_column_title` VARCHAR(191) NULL,
    `show_sterile_column` BOOLEAN NOT NULL DEFAULT FALSE,
    `origin_proforma_id` VARCHAR(191) NULL,
    `contact_name` VARCHAR(191) NULL,
    `contact_phone` VARCHAR(191) NULL,
    `order_number` VARCHAR(191) NULL,
    `shipment_details` JSON NULL,
    `financial_details` JSON NULL,
    `notes` JSON NOT NULL,
    `pdf_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `documents_number_key`(`number`),
    INDEX `documents_sender_id_idx`(`sender_id`),
    INDEX `documents_recipient_id_idx`(`recipient_id`),
    INDEX `documents_origin_proforma_id_idx`(`origin_proforma_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: document_sequences
CREATE TABLE IF NOT EXISTS `document_sequences` (
    `id` VARCHAR(191) NOT NULL PRIMARY KEY,
    `year_month` VARCHAR(191) NOT NULL,
    `last_number` INT NOT NULL DEFAULT 0,
    UNIQUE INDEX `document_sequences_year_month_key`(`year_month`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: app_settings
CREATE TABLE IF NOT EXISTS `app_settings` (
    `id` VARCHAR(191) NOT NULL PRIMARY KEY,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    UNIQUE INDEX `app_settings_key_key`(`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: documents → companies (sender)
ALTER TABLE `documents` ADD CONSTRAINT `documents_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: documents → companies (recipient)
ALTER TABLE `documents` ADD CONSTRAINT `documents_recipient_id_fkey` FOREIGN KEY (`recipient_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;