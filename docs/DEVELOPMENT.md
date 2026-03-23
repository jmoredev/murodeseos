# Guía de Desarrollo - Muro de Deseos

Esta guía proporciona instrucciones detalladas sobre cómo configurar, desarrollar y mantener el proyecto "Muro de Deseos".

## 🚀 Configuración del Proyecto

### Requisitos Previos
- [Bun](https://bun.sh/) (Runtime y gestor de paquetes)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (Opcional, para desarrollo local de DB)

### Instalación
1. Clona el repositorio:
   ```bash
   git clone <repo-url>
   cd murodeseos
   ```
2. Instala las dependencias:
   ```bash
   bun install
   ```
3. Configura las variables de entorno:
   Crea un archivo `.env.local` con las siguientes claves:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=tu_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   ```

## 🛠️ Desarrollo

### Ejecutar la aplicación
Para iniciar el servidor de desarrollo (Next.js/Expo Web):
```bash
bun run dev
```

### Comandos Útiles
- `bun run lint`: Ejecuta el linter.
- `bun run test`: Ejecuta todos los tests con Vitest.
- `bun run test:watch`: Ejecuta Vitest en modo watch.

## 🧪 Testing

El proyecto utiliza **Vitest** como framework de pruebas unitarias y de componentes.

### Estructura de pruebas
Los tests se encuentran en el directorio `__tests__`.
- Nombramiento: `Componente.test.tsx` o `utilidad.test.ts`.

### Mocks Globales
Si necesitas añadir mocks globales para nuevos módulos de terceros, edita `vitest.setup.ts`.

## ⚡ Estándares de Rendimiento

Para mantener la aplicación rápida y fluida:

1. **Peticiones en Paralelo**: Usa `Promise.all` para peticiones de Supabase en el mismo nivel lógico.
2. **Memoización**: Usa `React.memo` para componentes de lista pesados (ej. `GroupCard`).
3. **Joins vs Multiples Queries**: Prefiere Joins de Supabase cuando sea posible para reducir round-trips.
4. **Ternary Rendering**: Usa operadores ternarios `{cond ? <A /> : null}` en lugar de `&&` para evitar errores de renderizado en React Native Web/PWA.

## 🏗️ Arquitectura

- **Routing**: [Expo Router](https://expo.github.io/router) (File-based routing).
- **Layout**: `ResponsiveLayout.tsx` maneja la adaptación entre Desktop y Mobile.
- **Estilos**: NativeWind (Tailwind CSS para React Native).

---
*Muro de Deseos - Hecho con ❤️ para organizar tus regalos.*
