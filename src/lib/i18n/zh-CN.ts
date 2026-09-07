// 简体中文翻译
const zhCN: Record<string, string> = {
  // 通用
  'common.loading': '正在加载…',
  'common.error': '加载失败',
  'common.retry': '重试',
  'common.save': '保存',
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.search': '搜索',
  'common.export': '导出',
  'common.back': '返回',
  'common.submit': '提交',
  'common.copy': '复制',
  'common.copied': '已复制',

  // 导航
  'nav.home': '首页',
  'nav.admin': '管理后台',
  'nav.apiDocs': 'API 文档',
  'nav.shop': '购买激活码',
  'nav.login': '登录',

  // 首页
  'home.title': '激活码管理系统',
  'home.subtitle': '面向多项目、多授权模型与插件接入场景的一体化后台。发码、查码、看消费趋势，并把公开 API 文档直接交给接入方。',
  'home.enterAdmin': '进入管理后台',
  'home.buyLicense': '购买激活码',
  'home.viewApi': '查看 API 文档',
  'home.quickEntry': '快速入口',
  'home.adminDesc': '项目管理、发码、消费日志与系统配置工作台。',
  'home.shopDesc': '选择套餐、在线下单，支付成功后自动发放卡密。',
  'home.apiDesc': '正式接口、字段规范、SDK 示例与联调方法。',

  // 购买页
  'shop.title': '激活码购买中心',
  'shop.subtitle': '选择套餐、填写联系方式下单，支付成功后自动发放卡密。',
  'shop.selectPlan': '选择套餐',
  'shop.paymentMethod': '支付方式',
  'shop.contactEmail': '邮箱',
  'shop.contactPhone': '手机号',
  'shop.contactWechat': '微信号',
  'shop.contactHint': '（用于找回卡密，建议填写）',
  'shop.contactRequired': '请至少填写邮箱、手机号或微信号中的一种，用于以后找回卡密',
  'shop.orderNow': '立即下单',
  'shop.generating': '正在生成订单…',
  'shop.orderCreated': '订单已生成',
  'shop.orderNo': '订单号',
  'shop.product': '商品',
  'shop.amount': '金额',
  'shop.status': '状态',
  'shop.waitingPayment': '等待支付',
  'shop.paymentSuccess': '✅ 支付成功，卡密已发放',
  'shop.saveCode': '请妥善保存卡密。如遗失，可在下方用订单号 + 联系方式找回。',
  'shop.findCode': '找回卡密',
  'shop.findCodeDesc': '忘记卡密时，用下单时填写的邮箱 / 手机号 / 微信号 + 订单号即可重新获取。',
  'shop.noProducts': '暂无在售套餐',
  'shop.onlinePayment': '（在线支付）',
  'shop.manualConfirm': '（人工确认）',

  // API 文档页
  'api.title': 'API 对接指南',
  'api.subtitle': '正式接口、字段规范、SDK 示例与联调方法。',

  // 登录页
  'login.title': '管理员登录',
  'login.username': '用户名',
  'login.password': '密码',
  'login.loginButton': '登录后台',
  'login.loggingIn': '正在登录…',
  'login.error': '用户名或密码错误',
  'login.pleaseInput': '请填写用户名和密码',

  // 错误页
  'error.404': '404 · 页面不存在',
  'error.404title': '找不到这个页面',
  'error.404desc': '您访问的页面不存在或已被移除。',
  'error.500': '500 · 服务器错误',
  'error.500title': '服务器出了点问题',
  'error.500desc': '请稍后重试，或联系管理员。',
  'error.backHome': '返回首页',
}

export default zhCN