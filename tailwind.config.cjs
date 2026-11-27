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
      // ---------------------------------------------------------------------
      // Paleta canónica «Personas primero» — `design/rediseno-muro/sistema-nuevo.md` §1.
      //
      // Los nombres que la app ya usaba se REASIGNAN al valor canónico en vez
      // de renombrarse: así todas las `className` existentes siguen pintando
      // (S7) y los tramos siguientes sólo tienen que añadir/usar tokens. Entre
      // paréntesis, el token de la ficha que cada nombre de aquí representa.
      // ---------------------------------------------------------------------
      colors: {
        // --- Superficie y tinta (§1.1) ------------------------------------
        // `surface` es el LIENZO (--bg) y `surface-container-lowest` la
        // TARJETA (--surface), que es el papel que ya tenían: la app entera
        // usa `bg-surface` como fondo de pantalla.
        surface: '#FFF8F1', // --bg · lienzo
        'surface-bright': '#FFF8F1', // --bg · mismo lienzo (se conserva por compatibilidad)
        'surface-sunken': '#FFFCF8', // --surface-sunken · fila leída, tarjeta de Recibidos
        'surface-container-low': '#FBEBDC', // --sand · sección, panel, etiqueta de grupo
        'surface-container-high': '#F6EBE2', // --sand-2 · pista del interruptor, control deshabilitado
        // El relleno de los campos deja de ser el malva oscuro #ecd8e0: en el
        // sistema nuevo el campo es blanco con contorno de 2 px --border-control.
        'surface-container-highest': '#FFFFFF', // --surface · relleno de campo
        'surface-container-lowest': '#FFFFFF', // --surface · tarjeta, hoja, barra
        sand: '#FBEBDC',
        'sand-2': '#F6EBE2',
        'sand-ink': '#7A4A2A',
        ink: '#2B1A12',
        'ink-2': '#5C4033',
        muted: '#8A7A70', // SÓLO decoración y deshabilitado: 3,91:1 sobre --bg
        border: '#F0DFD2',
        'border-strong': '#E3C8B6',
        'border-control': '#B67A50', // contorno 2 px de todo control (S5, §12.2)
        unread: '#FFF6EC',
        'on-surface': '#2B1A12', // --ink
        'on-background': '#2B1A12', // --ink
        'outline-variant': '#E3C8B6', // --border-strong · contorno de fila, chip y tile

        // --- Teja (primario) (§1.2) --------------------------------------
        primary: '#B93D12',
        'primary-dark': '#8F2E0C',
        'primary-soft': '#FDE5D6',
        'primary-line': '#F3CDB6',
        'primary-line-strong': '#EEC4A8',
        'primary-container': '#F3CDB6', // se retira en favor de --primary-line
        'on-primary': '#FFFFFF',
        'hover-row': '#FFF1E5',
        'hover-control': '#FFF3E9',
        selected: '#FFF3EB',
        'active-soft': '#FBD9C4',

        // --- Verde (acento y éxito) (§1.3) -------------------------------
        accent: '#2F6F4E',
        'accent-soft': '#E1F0E7',
        'accent-ink': '#1F4A33',
        'accent-line': '#B4D5C3',

        // --- Estado (§1.4) ----------------------------------------------
        danger: '#B42318',
        'danger-dark': '#7A1A12',
        'danger-soft': '#FDECEA',
        'danger-line': '#EFC9C5',

        // --- Sobre tinta (§1.5) -----------------------------------------
        'on-ink': '#FFF3E8',
        'on-ink-accent': '#FFE9DA',

        // --- Significados heredados, reasignados a su papel nuevo -------
        // La prioridad y el precio dejan de tener color propio en T4 (corazones
        // + texto), pero mientras existan sus clases tienen que pintar dentro
        // de la paleta: teja para lo alto, arena para el precio, verde para lo
        // bajo y lo conseguido.
        'priority-high': '#B93D12', // --primary
        'priority-medium': '#7A4A2A', // --sand-ink
        'priority-low': '#2F6F4E', // --accent
        price: '#7A4A2A', // --sand-ink
        success: '#2F6F4E', // --accent
        'role-badge': '#7A4A2A', // --sand-ink
        reserved: '#2F6F4E', // --accent
        'accent-warm': '#7A4A2A', // --sand-ink
        'accent-cool': '#2F6F4E', // --accent

        // --- Alias heredados (evitar en UI nueva) -----------------------
        'muro-principal': '#B93D12', // --primary
        'deseo-acento': '#F3CDB6', // --primary-line
        'urgencia-coral': '#B93D12', // --primary
        'fondo-base': '#FFF8F1', // --bg
      },
      // Nunito, una sola familia (§2): el peso lo lleva la familia cargada, así
      // que los nombres de antes se conservan apuntando al peso canónico más
      // cercano. `--weight-body` es 600, de ahí que `sans` y `sans-medium` (el
      // 500 que la ficha normaliza) apunten a SemiBold.
      fontFamily: {
        sans: ['Nunito_600SemiBold'],
        'sans-medium': ['Nunito_600SemiBold'],
        'sans-semibold': ['Nunito_600SemiBold'],
        'sans-bold': ['Nunito_700Bold'],
        display: ['Nunito_700Bold'],
        'display-extrabold': ['Nunito_800ExtraBold'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        md: '0.75rem',
      },
      boxShadow: {
        // Las dos sombras ambientales siguen existiendo (los tramos de
        // estructura las retiran), pero ya con la tinta de la paleta nueva en
        // vez del granate #4c212b.
        ambient:
          '0 12px 24px rgba(43, 26, 18, 0.04), 0 4px 8px rgba(43, 26, 18, 0.03)',
        'ambient-lg':
          '0 16px 32px rgba(43, 26, 18, 0.06), 0 8px 16px rgba(43, 26, 18, 0.04)',
        // Sombras canónicas (§5) para los tramos siguientes. Llevan el prefijo
        // `sh-` para no chocar con los utilitarios de color (`shadow-danger`
        // sería ambiguo con la familia de color `danger`).
        'sh-1': '0 2px 8px rgba(43, 26, 18, 0.05)',
        'sh-2': '0 10px 28px rgba(43, 26, 18, 0.08)',
        'sh-cta': '0 8px 18px rgba(185, 61, 18, 0.22)',
        'sh-glow': '0 12px 30px rgba(185, 61, 18, 0.10)',
        'sh-toast': '0 14px 30px rgba(43, 26, 18, 0.30)',
        'sh-sheet': '0 -10px 30px rgba(43, 26, 18, 0.22)',
        'sh-dialog': '0 30px 70px rgba(43, 26, 18, 0.34)',
        'sh-bar': '0 -6px 18px rgba(43, 26, 18, 0.06)',
        'sh-danger': '0 8px 18px rgba(180, 35, 24, 0.22)',
      },
    },
  },
  plugins: [],
};
