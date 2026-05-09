-- CreateTable
CREATE TABLE `shipping_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `calc_type` INTEGER NOT NULL DEFAULT 1,
    `default_rule` JSON NOT NULL,
    `special_rules` JSON NOT NULL,
    `free_shipping_enabled` BOOLEAN NOT NULL DEFAULT false,
    `free_shipping_rules` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shipping_templates_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
