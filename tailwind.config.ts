import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#131921',
        sidebar: '#232F3E',
        accent: '#FF9900',
        success: '#067D62',
        warning: '#E67E22',
        error: '#E74C3C',
        surface: '#1A2332',
        'text-primary': '#FFFFFF',
        'text-secondary': '#B0BEC5',
        border: '#37475A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
