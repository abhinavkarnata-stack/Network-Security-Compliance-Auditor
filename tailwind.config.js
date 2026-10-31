export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        canvas: '#07090d',
        surface: '#0d1017',
        elevated: '#12161f',
        hairline: '#1e242f',
        hairlineStrong: '#2a323f',
        ink: '#e8ecf3',
        muted: '#8b95a7',
        faint: '#5d6779',
        accent: '#3d7dff',
        accentSoft: '#16233d',
        critical: '#ff4d5e',
        high: '#ff9147',
        medium: '#e8c74a',
        low: '#4fb3ff',
        ok: '#38c793',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};
