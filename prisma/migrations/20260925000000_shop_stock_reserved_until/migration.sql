-- 预占库存独立过期时间：与订单状态解耦，防止人工收款订单的预占永久锁死码池
ALTER TABLE "shop_product_code_stocks" ADD COLUMN "reservedUntil" DATETIME;
