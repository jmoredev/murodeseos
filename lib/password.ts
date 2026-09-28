/**
 * Mínimo de caracteres de una contraseña nueva.
 *
 * Tiene que coincidir con lo que exige el servidor: en producción lo fija el panel de
 * Supabase (Auth → Passwords) y en las pruebas el `supabase/config.toml` local. Con la
 * comprobación de contraseñas filtradas fuera del plan gratuito, esta longitud es la
 * protección que queda, así que los tres sitios se mueven juntos.
 *
 * Vive aquí porque estaba copiado en dos pantallas, y un número duplicado es un número que
 * se queda atrás: al subir el panel a 8, las dos copias siguieron en 6 y el usuario habría
 * recibido un error del servidor en vez de un mensaje claro.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** El mensaje del mínimo, o `null` si la contraseña lo cumple. */
export function validateNewPassword(password: string): string | null {
    return password.length < MIN_PASSWORD_LENGTH
        ? `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
        : null;
}
