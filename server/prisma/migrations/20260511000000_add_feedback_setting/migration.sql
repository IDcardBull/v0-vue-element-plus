-- CreateTable: feedbacks
CREATE TABLE `feedbacks` (
  `id`         INTEGER NOT NULL AUTO_INCREMENT,
  `type`       VARCHAR(32)  NOT NULL DEFAULT 'aftersale',
  `order_code` VARCHAR(64)  NOT NULL DEFAULT '',
  `content`    VARCHAR(1000) NOT NULL,
  `contact`    VARCHAR(128) NOT NULL DEFAULT '',
  `images`     JSON NULL,
  `user_id`    INTEGER NULL,
  `status`     INTEGER NOT NULL DEFAULT 0,
  `forwarded`  BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `feedbacks_type_status_idx`(`type`, `status`),
  INDEX `feedbacks_created_at_idx`(`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: settings (通用 key-value)
CREATE TABLE `settings` (
  `id`         INTEGER NOT NULL AUTO_INCREMENT,
  `key`        VARCHAR(128) NOT NULL,
  `value`      TEXT NULL,
  `remark`     VARCHAR(255) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `settings_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed
INSERT INTO `settings` (`key`, `value`, `remark`, `updated_at`)
VALUES ('wework_bot_url', '', '企业微信群机器人 Webhook URL（用于客服反馈通知）', CURRENT_TIMESTAMP(3));
