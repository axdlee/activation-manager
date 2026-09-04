/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ===== 品牌色板：以深蓝为主，克制饱和 =====
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0eaff',
          200: '#c7d9fe',
          300: '#a4bffd',
          400: '#809bf9',
          500: '#5b74f4',
          600: '#4055e8',
          700: '#3343cd',
          800: '#2b39a4',
          900: '#293482',
          950: '#1a2149',
        },
        surface: {
          50: '#fafbfc',
          100: '#f3f5f7',
          200: '#e8ebef',
          300: '#d6dbe3',
        },
      },
      // ===== 圆角阶梯（统一 6 档） =====
      borderRadius: {
        sm: '0.375rem',      // 6px  chips/badge
        DEFAULT: '0.5rem',   // 8px  按钮/输入
        md: '0.625rem',      // 10px 卡片内元素
        lg: '0.75rem',       // 12px 卡片
        xl: '1rem',          // 16px 弹窗/大卡片
      },
      // ===== 阴影阶梯（低对比、细腻） =====
      boxShadow: {
        card: '0 1px 2px 0 rgb(26 33 73 / 0.04), 0 1px 3px 0 rgb(26 33 73 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(26 33 73 / 0.10), 0 2px 4px -1px rgb(26 33 73 / 0.06)',
        modal: '0 20px 48px -12px rgb(26 33 73 / 0.25)',
      },
      // ===== 动效 =====
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 320ms cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}