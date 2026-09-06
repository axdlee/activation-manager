import type { Metadata } from 'next'

import { ShopPage } from '@/components/shop-page'

export const metadata: Metadata = {
  title: '购买激活码',
  description: '选择激活码套餐，填写联系方式完成下单，支付成功后自动发放卡密。',
}

export default function ShopRoute() {
  return <ShopPage />
}
