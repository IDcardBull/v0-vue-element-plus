/*
  Warnings:

  - You are about to drop the column `brand_id` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `craft` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `material` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `skus` table. All the data in the column will be lost.
  - You are about to drop the column `in_transit` on the `stocks` table. All the data in the column will be lost.
  - You are about to drop the column `reserved` on the `stocks` table. All the data in the column will be lost.
  - You are about to drop the column `warn_max` on the `stocks` table. All the data in the column will be lost.
  - You are about to drop the column `warn_min` on the `stocks` table. All the data in the column will be lost.
  - You are about to drop the `brands` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stock_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `products` DROP FOREIGN KEY `products_brand_id_fkey`;

-- DropForeignKey
ALTER TABLE `stock_logs` DROP FOREIGN KEY `stock_logs_sku_id_fkey`;

-- DropForeignKey
ALTER TABLE `stock_logs` DROP FOREIGN KEY `stock_logs_warehouse_id_fkey`;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `brand_id`,
    DROP COLUMN `craft`,
    DROP COLUMN `material`;

-- AlterTable
ALTER TABLE `skus` DROP COLUMN `stock`;

-- AlterTable
ALTER TABLE `stocks` DROP COLUMN `in_transit`,
    DROP COLUMN `reserved`,
    DROP COLUMN `warn_max`,
    DROP COLUMN `warn_min`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `app_channel` VARCHAR(16) NOT NULL DEFAULT 'retail';

-- DropTable
DROP TABLE `brands`;

-- DropTable
DROP TABLE `stock_logs`;
