-- CreateTable
CREATE TABLE `instagram_profiles` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'instagram-profile',
    `handle` VARCHAR(100) NULL,
    `bio` TEXT NULL,
    `profile_picture_url` VARCHAR(500) NULL,
    `profile_media_id` CHAR(36) NULL,
    `follower_count` INTEGER NULL,
    `following_count` INTEGER NULL,
    `post_count` INTEGER NULL,
    `latest_post_url` VARCHAR(500) NULL,
    `latest_post_image_url` VARCHAR(500) NULL,
    `latest_post_caption` TEXT NULL,
    `latest_post_date` DATETIME(3) NULL,
    `latest_post_media_id` CHAR(36) NULL,
    `last_synced_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `instagram_profiles_profile_media_id_key`(`profile_media_id`),
    UNIQUE INDEX `instagram_profiles_latest_post_media_id_key`(`latest_post_media_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `instagram_profiles` ADD CONSTRAINT `instagram_profiles_profile_media_id_fkey` FOREIGN KEY (`profile_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instagram_profiles` ADD CONSTRAINT `instagram_profiles_latest_post_media_id_fkey` FOREIGN KEY (`latest_post_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
