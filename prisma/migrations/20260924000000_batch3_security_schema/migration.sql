-- 评审批次3 安全加固相关 schema 变更：
-- 1) 激活码软删除标记（绑定历史受限时保留历史行）
ALTER TABLE "activation_codes" ADD COLUMN "deletedAt" DATETIME;

-- 2) 到期通知去重时间戳（持久化 7 天窗口，进程重启不重复通知）
ALTER TABLE "activation_codes" ADD COLUMN "expiryNotifiedAt" DATETIME;

-- 3) 管理员令牌版本（修改密码后旧 JWT 全部失效）
ALTER TABLE "admins" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- 4) 商城订单详情访问令牌（防订单号枚举读取卡密）
ALTER TABLE "shop_orders" ADD COLUMN "accessToken" TEXT;
CREATE UNIQUE INDEX "shop_orders_accessToken_key" ON "shop_orders"("accessToken");
