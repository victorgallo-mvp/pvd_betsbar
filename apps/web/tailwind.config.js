/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Status de mesa
        mesa: {
          free: '#6B7280',       // cinza — livre
          open: '#10B981',       // verde esmeralda — aberta
          awaiting: '#F59E0B',   // âmbar — aguardando pagamento
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
