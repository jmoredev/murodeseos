/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'muro-principal': '#192A56',
        'deseo-acento': '#FFC312',
        'urgencia-coral': '#FF6B81',
        'fondo-base': '#F5F6FA',
      },
    },
  },
  plugins: [],
}
