/**
 * Configuración de la extracción leída del entorno, como **módulo puro**.
 *
 * Vive acá y no en la Edge Function porque la función usa APIs de `Deno` y está fuera del `tsc` y
 * del runner de tests: un lector de configuración que no se puede probar es un lector que nadie
 * mira cuando pisa un valor explícito.
 *
 * Regla que vale para las tres perillas: **un 0 explícito se honra donde 0 significa algo** —límite
 * de cuota apagado, caché apagada— y se descarta donde no es representable (una ventana de cero no
 * existe: la función SQL la rechaza). Lo que nunca pasa es que un 0 explícito se convierta en el
 * valor por defecto, que es conceder de más a quien pidió nada.
 */

/** Lector de entorno inyectable, con la forma de `Deno.env.get`. */
export type GetEnv = (nombre: string) => string | undefined;

export type ExtractionConfig = {
    /** Extracciones permitidas por usuario y ventana. */
    limite: number;
    /** Tamaño de la ventana fija, alineada a época. */
    ventanaSegundos: number;
    /** Vida del borrador en la caché. */
    ttlSegundos: number;
    /** Rescates con Firecrawl permitidos por usuario y ventana de 30 días. 0 lo apaga. */
    fallbackLimite: number;
};

export const LIMITE_POR_DEFECTO = 30;
export const VENTANA_POR_DEFECTO = 3600;
export const TTL_POR_DEFECTO = 3600;
/**
 * Rescates con Firecrawl por usuario y mes. Con 1.000 créditos al mes y ~12 usuarios, 20 deja 240 de
 * techo real y 760 de margen (D2 de `odd/tasks/respaldo-firecrawl.md`).
 */
export const FALLBACK_LIMITE_POR_DEFECTO = 20;

/** Nombres de las variables, en un solo sitio para que no se desalineen con la documentación. */
export const NOMBRES_DE_ENTORNO = {
    limite: 'PRODUCT_EXTRACTION_QUOTA_LIMIT',
    ventana: 'PRODUCT_EXTRACTION_QUOTA_WINDOW_SECONDS',
    ttl: 'PRODUCT_EXTRACTION_CACHE_TTL_SECONDS',
    fallbackLimite: 'PRODUCT_FALLBACK_LIMIT',
} as const;

/** El texto como entero, o `null` si la variable no está o no es un número. */
function comoEntero(crudo: string | undefined): number | null {
    if (crudo === undefined) return null;
    const valor = Number.parseInt(crudo, 10);
    return Number.isFinite(valor) ? valor : null;
}

/**
 * Límite de cuota. Un **0 explícito se honra**: apagar la extracción es una decisión operativa, y
 * el resto del sistema la entiende (la función SQL rechaza `p_limit <= 0` sin tocar la tabla y
 * `decideQuota` con 0 nunca permite). Un negativo se lee como 0 —«menos que nada» no es un número
 * con significado, y la lectura segura es «nada»—. Solo un texto que no es número cae al valor por
 * defecto.
 */
function leerLimite(getEnv: GetEnv): number {
    const valor = comoEntero(getEnv(NOMBRES_DE_ENTORNO.limite));
    if (valor === null) return LIMITE_POR_DEFECTO;
    return valor < 0 ? 0 : valor;
}

/** Ventana: 0 no es representable —la función SQL la rechaza— así que cae al valor por defecto. */
function leerVentana(getEnv: GetEnv): number {
    const valor = comoEntero(getEnv(NOMBRES_DE_ENTORNO.ventana));
    return valor === null || valor <= 0 ? VENTANA_POR_DEFECTO : valor;
}

/** TTL: un **0 explícito apaga la caché** (el borrador expira al guardarse); un negativo, no. */
function leerTtl(getEnv: GetEnv): number {
    const valor = comoEntero(getEnv(NOMBRES_DE_ENTORNO.ttl));
    return valor === null || valor < 0 ? TTL_POR_DEFECTO : valor;
}

export function readExtractionConfig(getEnv: GetEnv): ExtractionConfig {
    return {
        limite: leerLimite(getEnv),
        ventanaSegundos: leerVentana(getEnv),
        ttlSegundos: leerTtl(getEnv),
        fallbackLimite: leerFallbackLimite(getEnv),
    };
}

/**
 * Rescates por usuario y mes. Misma regla que el límite de extracción: **un 0 explícito apaga el
 * respaldo**, un negativo se lee como 0 y solo un texto que no es número cae al valor por defecto.
 */
function leerFallbackLimite(getEnv: GetEnv): number {
    const valor = comoEntero(getEnv(NOMBRES_DE_ENTORNO.fallbackLimite));
    if (valor === null) return FALLBACK_LIMITE_POR_DEFECTO;
    return valor < 0 ? 0 : valor;
}

/**
 * ¿Se usa la caché con esta configuración?
 *
 * La regla la define este módulo, y quien la consume **tiene que preguntarla** en vez de mirar
 * `expires_at` por su cuenta: con la caché apagada a mano durante un incidente, las filas que se
 * escribieron antes siguen vigentes hasta su vencimiento original, así que filtrar solo por fecha
 * las seguiría sirviendo —y con TTL 0 se seguiría escribiendo—, que es lo contrario de lo que pidió
 * quien apagó la caché.
 */
export function isCacheEnabled(config: Pick<ExtractionConfig, 'ttlSegundos'>): boolean {
    return config.ttlSegundos > 0;
}
