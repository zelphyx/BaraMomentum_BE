-- AlterTable
ALTER TABLE `media_assets` ADD COLUMN `alt` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `organization_units` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `short_name` VARCHAR(50) NULL,
    `type` ENUM('TEAM', 'BUREAU', 'DIVISION') NOT NULL,
    `logo_media_id` CHAR(36) NULL,
    `summary` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `seo_title` VARCHAR(255) NULL,
    `seo_desc` VARCHAR(160) NULL,
    `created_by_id` CHAR(36) NULL,
    `updated_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `organization_units_slug_key`(`slug`),
    INDEX `organization_units_status_sort_order_idx`(`status`, `sort_order`),
    INDEX `organization_units_type_status_idx`(`type`, `status`),
    INDEX `organization_units_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_strategies` (
    `id` CHAR(36) NOT NULL,
    `organization_unit_id` CHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `unit_strategies_organization_unit_id_idx`(`organization_unit_id`),
    UNIQUE INDEX `unit_strategies_organization_unit_id_sort_order_key`(`organization_unit_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_programs` (
    `id` CHAR(36) NOT NULL,
    `organization_unit_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `schedule_label` VARCHAR(100) NULL,
    `external_url` VARCHAR(1024) NULL,
    `status` ENUM('PLANNED', 'ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'PLANNED',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `unit_programs_organization_unit_id_sort_order_idx`(`organization_unit_id`, `sort_order`),
    INDEX `unit_programs_organization_unit_id_idx`(`organization_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_members` (
    `id` CHAR(36) NOT NULL,
    `organization_unit_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `role` VARCHAR(100) NOT NULL,
    `photo_media_id` CHAR(36) NULL,
    `photo_alt` VARCHAR(255) NULL,
    `instagram_url` VARCHAR(255) NULL,
    `linkedin_url` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `unit_members_organization_unit_id_sort_order_idx`(`organization_unit_id`, `sort_order`),
    INDEX `unit_members_organization_unit_id_idx`(`organization_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `user_unit_assignments_organization_unit_id_idx` ON `user_unit_assignments`(`organization_unit_id`);

-- AddForeignKey
ALTER TABLE `user_unit_assignments` ADD CONSTRAINT `user_unit_assignments_organization_unit_id_fkey` FOREIGN KEY (`organization_unit_id`) REFERENCES `organization_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_units` ADD CONSTRAINT `organization_units_logo_media_id_fkey` FOREIGN KEY (`logo_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_units` ADD CONSTRAINT `organization_units_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_units` ADD CONSTRAINT `organization_units_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_strategies` ADD CONSTRAINT `unit_strategies_organization_unit_id_fkey` FOREIGN KEY (`organization_unit_id`) REFERENCES `organization_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_programs` ADD CONSTRAINT `unit_programs_organization_unit_id_fkey` FOREIGN KEY (`organization_unit_id`) REFERENCES `organization_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_members` ADD CONSTRAINT `unit_members_organization_unit_id_fkey` FOREIGN KEY (`organization_unit_id`) REFERENCES `organization_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_members` ADD CONSTRAINT `unit_members_photo_media_id_fkey` FOREIGN KEY (`photo_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
