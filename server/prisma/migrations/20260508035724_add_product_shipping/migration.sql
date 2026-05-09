-- CreateTable
CREATE TABLE `admin_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `real_name` VARCHAR(64) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(128) NULL,
    `avatar` VARCHAR(500) NULL,
    `department` VARCHAR(64) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `menu_perms` JSON NULL,
    `data_perms` JSON NULL,
    `api_perms` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_user_roles` (
    `admin_user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,

    PRIMARY KEY (`admin_user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `admin_user_id` INTEGER NULL,
    `username` VARCHAR(64) NOT NULL,
    `module` VARCHAR(64) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `method` VARCHAR(10) NULL,
    `path` VARCHAR(255) NULL,
    `params` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'success',
    `error_msg` VARCHAR(500) NULL,
    `duration_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operation_logs_admin_user_id_idx`(`admin_user_id`),
    INDEX `operation_logs_module_action_idx`(`module`, `action`),
    INDEX `operation_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(64) NULL,
    `unionid` VARCHAR(64) NULL,
    `phone` VARCHAR(20) NULL,
    `nickname` VARCHAR(64) NULL,
    `avatar` VARCHAR(500) NULL,
    `gender` INTEGER NULL,
    `role` VARCHAR(16) NOT NULL DEFAULT 'retail',
    `level_id` INTEGER NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_spent` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `registered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_active_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_openid_key`(`openid`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_role_status_idx`(`role`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_levels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `min_spent` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(4, 2) NOT NULL,
    `points_rate` DECIMAL(4, 2) NOT NULL,
    `icon` VARCHAR(500) NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `user_levels_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `receiver` VARCHAR(64) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `province` VARCHAR(32) NOT NULL,
    `city` VARCHAR(32) NOT NULL,
    `district` VARCHAR(32) NOT NULL,
    `detail` VARCHAR(255) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `tag` VARCHAR(16) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `addresses_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `distributors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `company_name` VARCHAR(128) NOT NULL,
    `contact_name` VARCHAR(64) NOT NULL,
    `contact_phone` VARCHAR(20) NOT NULL,
    `region` VARCHAR(64) NULL,
    `business_license` VARCHAR(500) NULL,
    `legal_person` VARCHAR(64) NULL,
    `level` VARCHAR(16) NOT NULL DEFAULT 'normal',
    `credit_limit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `credit_used` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_purchase` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `last_order_at` DATETIME(3) NULL,
    `audit_status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `audit_remark` VARCHAR(500) NULL,
    `audited_by` INTEGER NULL,
    `audited_at` DATETIME(3) NULL,
    `salesman_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `distributors_user_id_key`(`user_id`),
    INDEX `distributors_level_audit_status_idx`(`level`, `audit_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dict_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dict_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dict_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_code` VARCHAR(64) NOT NULL,
    `label` VARCHAR(128) NOT NULL,
    `value` VARCHAR(128) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dict_items_type_code_status_sort_idx`(`type_code`, `status`, `sort`),
    UNIQUE INDEX `dict_items_type_code_value_key`(`type_code`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parent_id` INTEGER NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `icon` VARCHAR(500) NULL,
    `description` VARCHAR(500) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_code_key`(`code`),
    INDEX `categories_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `logo` VARCHAR(500) NULL,
    `country` VARCHAR(64) NULL,
    `origin` VARCHAR(128) NULL,
    `story` TEXT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `brands_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category_id` INTEGER NULL,
    `brand_id` INTEGER NULL,
    `craft` VARCHAR(64) NULL,
    `material` VARCHAR(64) NULL,
    `main_image` VARCHAR(500) NULL,
    `images` JSON NULL,
    `detail` LONGTEXT NULL,
    `tags` JSON NULL,
    `retail_enabled` BOOLEAN NOT NULL DEFAULT true,
    `retail_price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `member_price` DECIMAL(10, 2) NULL,
    `cost_price` DECIMAL(10, 2) NULL,
    `promo_activities` JSON NULL,
    `wholesale_enabled` BOOLEAN NOT NULL DEFAULT false,
    `min_wholesale_qty` INTEGER NOT NULL DEFAULT 1,
    `dealer_levels` JSON NULL,
    `free_shipping` BOOLEAN NOT NULL DEFAULT false,
    `shipping_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `sales_count` INTEGER NOT NULL DEFAULT 0,
    `rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_code_key`(`code`),
    INDEX `products_category_id_idx`(`category_id`),
    INDEX `products_brand_id_idx`(`brand_id`),
    INDEX `products_status_retail_enabled_wholesale_enabled_idx`(`status`, `retail_enabled`, `wholesale_enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `specs` JSON NOT NULL,
    `image` VARCHAR(500) NULL,
    `retail_price` DECIMAL(10, 2) NOT NULL,
    `member_price` DECIMAL(10, 2) NULL,
    `cost_price` DECIMAL(10, 2) NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `weight` DECIMAL(8, 3) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `skus_code_key`(`code`),
    INDEX `skus_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_tiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku_id` INTEGER NOT NULL,
    `min_qty` INTEGER NOT NULL,
    `max_qty` INTEGER NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_tiers_sku_id_idx`(`sku_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `address` VARCHAR(255) NULL,
    `manager` VARCHAR(64) NULL,
    `phone` VARCHAR(20) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `is_default` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `warehouses_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `on_hand` INTEGER NOT NULL DEFAULT 0,
    `reserved` INTEGER NOT NULL DEFAULT 0,
    `in_transit` INTEGER NOT NULL DEFAULT 0,
    `warn_min` INTEGER NOT NULL DEFAULT 10,
    `warn_max` INTEGER NOT NULL DEFAULT 1000,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stocks_sku_id_warehouse_id_key`(`sku_id`, `warehouse_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(64) NOT NULL,
    `type` VARCHAR(16) NOT NULL,
    `sku_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL,
    `before_on_hand` INTEGER NOT NULL,
    `after_on_hand` INTEGER NOT NULL,
    `related_id` INTEGER NULL,
    `related_type` VARCHAR(32) NULL,
    `operator` VARCHAR(64) NOT NULL,
    `remark` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_logs_order_no_idx`(`order_no`),
    INDEX `stock_logs_type_created_at_idx`(`type`, `created_at`),
    INDEX `stock_logs_sku_id_idx`(`sku_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(64) NOT NULL,
    `user_id` INTEGER NULL,
    `channel` VARCHAR(16) NOT NULL,
    `source` VARCHAR(32) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending_pay',
    `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `freight` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `use_credit` BOOLEAN NOT NULL DEFAULT false,
    `settled` BOOLEAN NOT NULL DEFAULT false,
    `address_id` INTEGER NULL,
    `receiver_snapshot` JSON NULL,
    `pay_method` VARCHAR(16) NULL,
    `paid_at` DATETIME(3) NULL,
    `pay_trans_id` VARCHAR(128) NULL,
    `logistics_company` VARCHAR(64) NULL,
    `tracking_no` VARCHAR(64) NULL,
    `shipped_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `remark` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_order_no_key`(`order_no`),
    INDEX `orders_user_id_status_idx`(`user_id`, `status`),
    INDEX `orders_channel_status_idx`(`channel`, `status`),
    INDEX `orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `product_id` INTEGER NOT NULL,
    `sku_id` INTEGER NOT NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `sku_spec` VARCHAR(255) NULL,
    `sku_image` VARCHAR(500) NULL,
    `qty` INTEGER NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,

    INDEX `order_items_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `statements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `statement_no` VARCHAR(64) NOT NULL,
    `distributor_id` INTEGER NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `order_count` INTEGER NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(14, 2) NOT NULL,
    `paid_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `due_date` DATETIME(3) NULL,
    `settled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `statements_statement_no_key`(`statement_no`),
    INDEX `statements_distributor_id_status_idx`(`distributor_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_level_id_fkey` FOREIGN KEY (`level_id`) REFERENCES `user_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributors` ADD CONSTRAINT `distributors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dict_items` ADD CONSTRAINT `dict_items_type_code_fkey` FOREIGN KEY (`type_code`) REFERENCES `dict_types`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skus` ADD CONSTRAINT `skus_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_tiers` ADD CONSTRAINT `price_tiers_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `skus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocks` ADD CONSTRAINT `stocks_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `skus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocks` ADD CONSTRAINT `stocks_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `skus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_address_id_fkey` FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `skus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
