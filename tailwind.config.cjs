/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#aa2c32',
        'primary-container': '#ff7574',
        'on-primary': '#ffffff',
        surface: '#fff4f4',
        'surface-bright': '#fff4f4',
        'surface-container-low': '#ffecee',
        'surface-container-high': '#fff0f0',
        // Relleno de inputs: entre el lienzo y el gris-malva; armoniza con #ffecee / surface sin el salto de #d6c2ce
        'surface-container-highest': '#ecd8e0',
        'surface-container-lowest': '#ffffff',
        secondary: '#6d5a00',
        tertiary: '#006666',
        'on-surface': '#4c212b',
        'on-background': '#4c212b',
        'outline-variant': '#dc9ca8',
        // Legacy aliases (evitar en UI nueva; quitar cuando no queden referencias)
        'muro-principal': '#aa2c32',
        'deseo-acento': '#ff7574',
        'urgencia-coral': '#aa2c32',
        'fondo-base': '#fff4f4',
      },
      fontFamily: {
        sans: ['BeVietnamPro_400Regular'],
        'sans-medium': ['BeVietnamPro_500Medium'],
        'sans-semibold': ['BeVietnamPro_600SemiBold'],
        'sans-bold': ['BeVietnamPro_700Bold'],
        display: ['PlusJakartaSans_700Bold'],
        'display-extrabold': ['PlusJakartaSans_800ExtraBold'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        md: '0.75rem',
      },
      boxShadow: {
        ambient:
          '0 12px 24px rgba(76, 33, 43, 0.04), 0 4px 8px rgba(76, 33, 43, 0.03)',
        'ambient-lg':
          '0 16px 32px rgba(76, 33, 43, 0.06), 0 8px 16px rgba(76, 33, 43, 0.04)',
      },
    },
  },
  plugins: [],
};
