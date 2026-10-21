import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * El idioma de la interfaz es **español de España**: se tutea («Comparte», «carga», «elige») y el
 * léxico es el de España («móvil», no «celular»). Decisión del propietario (2026-10-21), y el
 * motivo de este test es que la regla no se pierda: la copy de la app la escriben personas (y
 * modelos) que por defecto tutean en rioplatense, y sin guardián eso vuelve a colarse — pasó con
 * las viñetas de «Novedades».
 *
 * **Qué mira:** `app/`, `components/`, `lib/` y `supabase/functions/`, sin comentarios.
 * **Qué no mira:** comentarios de código, fichas de `odd/`, documentación y tests: eso no lo ve el
 * usuario y se escribe como venga.
 *
 * **Dos trampas que este fichero ya pisó, y que conviene no repetir:**
 *
 * 1. `\b` de JavaScript es **ASCII**: en `/compartí\b/` el límite después de `í` no existe, porque
 *    `í` y el espacio son los dos «no palabra» para el motor. Con `\b`, casi toda esta lista nunca
 *    matchea y el guardián es decorativo. Se usan lookarounds Unicode (`\p{L}`), que sí entienden
 *    letras acentuadas.
 * 2. Los ficheros del repo están en **CRLF**, y en JavaScript `.` no coincide con `\r`: un
 *    `/\/\/.*$/` no borra el comentario al final de una línea CRLF. Se normaliza antes de analizar.
 */

/** Forma a buscar y cómo se dice en es-ES, para que el fallo se lea como una corrección. */
const MARCAS: { forma: string; nota: string }[] = [
    { forma: 'compartí', nota: 'voseo: comparte' },
    { forma: 'cargá', nota: 'voseo: carga' },
    { forma: 'elegí', nota: 'voseo: elige' },
    { forma: 'cerrá', nota: 'voseo: cierra' },
    { forma: 'mirá', nota: 'voseo: mira' },
    { forma: 'decime', nota: 'voseo: dime' },
    { forma: 'andá', nota: 'voseo: ve' },
    { forma: 'fijate', nota: 'voseo: fíjate' },
    { forma: 'probá', nota: 'voseo: prueba' },
    { forma: 'acordate', nota: 'voseo: acuérdate' },
    { forma: 'usá', nota: 'voseo: usa' },
    { forma: 'poné', nota: 'voseo: pon' },
    { forma: 'dejá', nota: 'voseo: deja' },
    { forma: 'buscá', nota: 'voseo: busca' },
    { forma: 'agregá', nota: 'voseo: agrega' },
    { forma: 'sumá', nota: 'voseo: suma' },
    { forma: 'abrí', nota: 'voseo: abre' },
    { forma: 'guardá', nota: 'voseo: guarda' },
    { forma: 'borrá', nota: 'voseo: borra' },
    { forma: 'editá', nota: 'voseo: edita' },
    { forma: 'aceptá', nota: 'voseo: acepta' },
    { forma: 'cancelá', nota: 'voseo: cancela' },
    { forma: 'volvé', nota: 'voseo: vuelve' },
    { forma: 'entrá', nota: 'voseo: entra' },
    { forma: 'salí', nota: 'voseo: sal' },
    { forma: 'empezá', nota: 'voseo: empieza' },
    { forma: 'terminá', nota: 'voseo: termina' },
    { forma: 'escribí', nota: 'voseo: escribe' },
    { forma: 'seleccioná', nota: 'voseo: selecciona' },
    { forma: 'tocá', nota: 'voseo: toca' },
    { forma: 'revisá', nota: 'voseo: revisa' },
    { forma: 'confirmá', nota: 'voseo: confirma' },
    { forma: 'intentá', nota: 'voseo: intenta' },
    { forma: 'esperá', nota: 'voseo: espera' },
    { forma: 'recordá', nota: 'voseo: recuerda' },
    { forma: 'instalá', nota: 'voseo: instala' },
    { forma: 'avisá', nota: 'voseo: avisa' },
    { forma: 'mandá', nota: 'voseo: manda' },
    { forma: 'tenés', nota: 'voseo: tienes' },
    { forma: 'podés', nota: 'voseo: puedes' },
    { forma: 'querés', nota: 'voseo: quieres' },
    { forma: 'sabés', nota: 'voseo: sabes' },
    { forma: 'hacé', nota: 'voseo: haz' },
    { forma: 'vení', nota: 'voseo: ven' },
    { forma: 'pasale', nota: 'voseo: pásale' },
    { forma: 'decile', nota: 'voseo: dile' },
    { forma: 'contame', nota: 'voseo: cuéntame' },
    { forma: 'avisame', nota: 'voseo: avísame' },
    { forma: 'mostrame', nota: 'voseo: muéstrame' },
    { forma: 'recuperá', nota: 'voseo: recupera' },
    { forma: 'completá', nota: 'voseo: completa' },
    { forma: 'anotá', nota: 'voseo: anota' },
    { forma: 'apuntá', nota: 'voseo: apunta' },
    { forma: 'invitá', nota: 'voseo: invita' },
    { forma: 'creá', nota: 'voseo: crea' },
    { forma: 'cambiá', nota: 'voseo: cambia' },
    { forma: 'actualizá', nota: 'voseo: actualiza' },
    { forma: 'eliminá', nota: 'voseo: elimina' },
    { forma: 'copiá', nota: 'voseo: copia' },
    { forma: 'pegá', nota: 'voseo: pega' },
    { forma: 'subí', nota: 'voseo: sube' },
    { forma: 'bajá', nota: 'voseo: baja' },
    { forma: 'adjuntá', nota: 'voseo: adjunta' },
    { forma: 'marcá', nota: 'voseo: marca' },
    { forma: 'enviá', nota: 'voseo: envía' },
    { forma: 'reenviá', nota: 'voseo: reenvía' },
    { forma: 'respondé', nota: 'voseo: responde' },
    { forma: 'decidí', nota: 'voseo: decide' },
    { forma: 'pedí', nota: 'voseo: pide' },
    { forma: 'repetí', nota: 'voseo: repite' },
    { forma: 'seguí', nota: 'voseo: sigue' },
    { forma: 'sos', nota: 'voseo: eres' },
    { forma: 'acá', nota: 'léxico: aquí' },
    { forma: 'allá', nota: 'léxico: allí' },
    { forma: 'recién', nota: 'léxico: solo/apenas' },
    { forma: 'celular', nota: 'léxico: móvil' },
    { forma: 'computadora', nota: 'léxico: ordenador' },
    { forma: 'plata', nota: 'léxico: dinero' },
    { forma: 'pibe', nota: 'léxico: chico' },
    { forma: 'laburo', nota: 'léxico: trabajo' },
    { forma: 'guita', nota: 'léxico: dinero' },
];

/**
 * Patrón de una marca, con límites **Unicode**: `\p{L}` incluye letras acentuadas, así que
 * `compartí` se detecta dentro de «Compartí un producto» y no dentro de «compartía».
 */
function patronDe(forma: string): RegExp {
    return new RegExp(`(?<!\\p{L})${forma}(?!\\p{L})`, 'iu');
}

const PATRONES = MARCAS.map(({ forma, nota }) => ({ patron: patronDe(forma), nota, forma }));

/** Las notas de todas las marcas presentes en un texto. Vacío = el texto está limpio. */
export function marcasEn(texto: string): string[] {
    return PATRONES.filter(({ patron }) => patron.test(texto)).map(({ nota }) => nota);
}

const RAICES = ['app', 'components', 'lib', 'supabase/functions'];
const RAIZ = path.resolve(__dirname, '..');

function ficherosDeCopy(directorio: string): string[] {
    const absoluto = path.join(RAIZ, directorio);
    const encontrados: string[] = [];

    for (const entrada of readdirSync(absoluto)) {
        const ruta = path.join(absoluto, entrada);
        if (statSync(ruta).isDirectory()) {
            encontrados.push(...ficherosDeCopy(path.join(directorio, entrada)));
            continue;
        }
        if (/\.(ts|tsx)$/.test(entrada)) encontrados.push(path.join(directorio, entrada));
    }

    return encontrados;
}

/**
 * Devuelve el texto **sin comentarios**, conservando los saltos de línea para que los números de
 * línea del informe sigan siendo los del fichero. Los comentarios de bloque se reemplazan por
 * espacios —incluidos los de varias líneas— y después se quita el comentario de línea.
 *
 * Límite conocido: un `//` dentro de una cadena (una URL) recorta el resto de esa línea. Solo puede
 * producir un falso **negativo** en esa línea, nunca un falso positivo.
 */
function sinComentarios(fuente: string): string {
    const normalizada = fuente.replace(/\r\n/g, '\n');
    const sinBloque = normalizada.replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ' '));

    return sinBloque
        .split('\n')
        .map((linea) => linea.replace(/\/\/[^\n]*$/, (comentario) => ' '.repeat(comentario.length)))
        .join('\n');
}

describe('idioma de la interfaz: español de España', () => {
    it('cada forma de la lista se detecta dentro de una frase', () => {
        // Sin esto, una forma con el patrón mal escrito queda en la lista y nunca matchea: es el
        // falso sentido de seguridad que ya pasó con `` y los acentos.
        for (const { forma } of MARCAS) {
            expect(marcasEn(`Por favor ${forma} esto ahora`), forma).not.toEqual([]);
        }
    });

    it('la lista cubre las formas de voseo conocidas, no solo las que aparecen en una frase', () => {
        // El meta-test de las frases históricas exigía «al menos una marca», así que «Recuperá… cerrá»
        // pasaba por `cerrá` y `recuperá` podía faltar sin que nadie lo notara. Acá se comprueba la
        // cobertura de la lista misma, forma por forma.
        const conocidas = [
            'recuperá', 'compartí', 'cargá', 'elegí', 'cerrá', 'instalá', 'usá', 'tenés', 'podés',
            'querés', 'sabés', 'hacé', 'decime', 'fijate', 'probá', 'acordate', 'completá', 'anotá',
            'invitá', 'creá', 'cambiá', 'actualizá', 'eliminá', 'copiá', 'pegá', 'subí', 'bajá',
            'enviá', 'respondé', 'seguí', 'avisá', 'mandá', 'esperá', 'recordá',
        ];
        const enLaLista = new Set(MARCAS.map(({ forma }) => forma));

        expect(conocidas.filter((forma) => !enLaLista.has(forma))).toEqual([]);
    });

    it('el guardián detecta las formas reales que ya se colaron una vez', () => {
        // Sin esto, el guardián puede quedar decorativo y nadie se entera: fue exactamente lo que
        // pasó con `\b` y las formas acentuadas.
        const historicas = [
            '🔗 Compartí un producto desde el móvil',
            '🎂 Cumpleaños y onomástica: cargá tus fechas en el perfil',
            '🔐 Recuperá tu contraseña y cerrá sesión desde el perfil',
            '📲 Instalá la app',
            'Método no permitido: usá POST.',
            'Si tenés dudas, escribí acá',
            '¿Qué querés hacer? No podés todavía',
            'Pasale el enlace a quien quieras',
        ];

        for (const texto of historicas) {
            expect(marcasEn(texto), texto).not.toEqual([]);
        }
    });

    it('no marca palabras que solo comparten el principio', () => {
        // `compartía`, `instalación` o `plataforma` no son voseo: los límites Unicode lo respetan.
        for (const texto of [
            'Yo compartía la lista',
            'La instalación de la app',
            'La plataforma de deseos',
            'El precio se actualiza solo',
        ]) {
            expect(marcasEn(texto), texto).toEqual([]);
        }
    });

    it('ninguna línea de copy usa voseo ni léxico rioplatense', () => {
        const faltas: string[] = [];

        for (const relativo of RAICES.flatMap(ficherosDeCopy)) {
            const lineas = sinComentarios(readFileSync(path.join(RAIZ, relativo), 'utf8')).split('\n');

            lineas.forEach((linea, indice) => {
                const marcas = marcasEn(linea);
                if (marcas.length > 0) {
                    faltas.push(`${relativo}:${indice + 1} → ${marcas.join(', ')} · ${linea.trim().slice(0, 110)}`);
                }
            });
        }

        expect(faltas, `Copy fuera de es-ES:\n${faltas.join('\n')}`).toEqual([]);
    });

    it('los precios se formatean con el locale de España', () => {
        // En es-ES el decimal es coma y el símbolo va detrás: `79,99 €`.
        const fuente = readFileSync(path.join(RAIZ, 'lib/format-price.ts'), 'utf8');

        expect(fuente).toContain("new Intl.NumberFormat('es-ES'");
    });

    it('el documento declara el idioma de la interfaz', () => {
        const fuente = readFileSync(path.join(RAIZ, 'app/_layout.tsx'), 'utf8');

        expect(fuente).toContain("document.documentElement.lang = 'es-ES'");
    });
});
