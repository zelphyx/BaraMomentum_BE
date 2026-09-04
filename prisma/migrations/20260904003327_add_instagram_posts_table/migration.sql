-- Add InstagramPost + InstagramPlacement tables.
-- The original `phase5_instagram` migration created the legacy `instagram_profiles`
-- table, but the schema was subsequently refactored to use `InstagramPost` +
-- `InstagramPlacement` instead. This migration was never generated, so production
-- databases running `migrate deploy` were missing the new tables. Symptom: every
-- Prisma query touching `instagramPost` failed with "Table doesn't exist",
-- surfaced as HTTP 500 INTERNAL_ERROR via the global exception filter.

-- CreateEnum
CREATE TABLE `instagram_posts` (
    `id` VARCHAR(36) NOT NULL,
    `canonical_url` VARCHAR(765) NOT NULL,
    `shortcode` VARCHAR(191) NOT NULL,
    `internal_title` VARCHAR(255) NULL,
    `content_type` ENUM('POST', 'REEL', 'CAROUSEL', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `internal_note` TEXT NULL,
    `created_by_id` VARCHAR(36) NULL,
    `updated_by_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `instagram_posts_canonical_url_key`(`canonical_url`),
    UNIQUE INDEX `instagram_posts_shortcode_key`(`shortcode`),
    INDEX `instagram_posts_status_deleted_at_idx`(`status`, `deleted_at`),
    INDEX `instagram_posts_shortcode_idx`(`shortcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instagram_placements` (
    `id` VARCHAR(36) NOT NULL,
    `post_id` VARCHAR(36) NOT NULL,
    `placement` ENUM('HOME', 'INFORMATION') NOT NULL,
    `is_highlighted` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `instagram_placements_post_id_placement_key`(`post_id`, `placement`),
    INDEX `instagram_placements_placement_is_highlighted_sort_order_idx`(`placement`, `is_highlighted`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `instagram_posts` ADD CONSTRAINT `instagram_posts_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instagram_posts` ADD CONSTRAINT `instagram_posts_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instagram_placements` ADD CONSTRAINT `instagram_placements_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `instagram_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
