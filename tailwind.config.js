/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ===== 深色科技风色板 =====
      colors: {
        brand: {
          50: '#eef0ff',
          100: '#d9ddff',
          200: '#b7beff',
          300: '#8c96ff',
          400: '#6b76f9',
          500: '#5b74f4', // 主品牌蓝（保持不变）
          600: '#4055e8',
          700: '#3343cd',
          800: '#2b39a4',
          900: '#293482',
          950: '#1a2149',
        },
        ink: {
          50: '#f0f2f8',  // 主文字
          100: '#e0e2ed',
          200: '#c4c8dc',
          300: '#a4a9c2',
          400: '#858ba7',
          500: '#6b718e', // 次要文字
          600: '#525772',
          700: '#3c4058',
          800: '#282c42',
          900: '#1a1d30',
          950: '#0d0f1a', // 页面背景
        },
        surface: {
          50: '#0d0f1a',  // 页面背景
          100: '#111420', // 卡片背景
          200: '#1a1d30', // 卡片边框
          300: '#252940', // 输入框边框
        },
      },
      // ===== 圆角 =====
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      // ===== 阴影 + 发光 =====
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 1px 3px 0 rgb(0 0 0 / 0.35)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.4), 0 2px 4px -1px rgb(0 0 0 / 0.3), 0 0 0 1px rgba(91 116 244 / 0.08)',
        glow: '0 0 20px rgba(91 116 244 / 0.12), 0 0 40px -8px rgba(91 116 244 / 0.08)',
        'glow-lg': '0 0 30px rgba(91 116 244 / 0.18), 0 0 60px -12px rgba(91 116 244 / 0.1)',
        modal: '0 24px 64px -12px rgb(0 0 0 / 0.6), 0 0 0 1px rgba(91 116 244 / 0.06)',
      },
      // ===== 动效 =====
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(91 116 244 / 0.12), 0 0 40px -8px rgba(91 116 244 / 0.08)' },
          '50%': { boxShadow: '0 0 25px rgba(91 116 244 / 0.22), 0 0 50px -8px rgba(91 116 244 / 0.15)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 400ms cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}