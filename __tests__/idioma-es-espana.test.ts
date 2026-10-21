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
 */

/** Formas que delatan voseo o léxico rioplatense en copy de interfaz. */
const MARCAS: { patron: RegExp; nota: string }[] = [
    { patron: /\bcompartí\b/i, nota: 'voseo: comparte' },
    { patron: /\bcargá\b/i, nota: 'voseo: carga' },
    { patron: /\belegí\b/i, nota: 'voseo: elige' },
    { patron: /\bcerrá\b/i, nota: 'voseo: cierra' },
    { patron: /\bmirá\b/i, nota: 'voseo: mira' },
    { patron: /\bdecime\b/i, nota: 'voseo: dime' },
    { patron: /\bandá\b/i, nota: 'voseo: ve' },
    { patron: /\bfijate\b/i, nota: 'voseo: fíjate' },
    { patron: /\bprobá\b/i, nota: 'voseo: prueba' },
    { patron: /\bacordate\b/i, nota: 'voseo: acuérdate' },
    { patron: /\busá\b/i, nota: 'voseo: usa' },
    { patron: /\bponé\b/i, nota: 'voseo: pon' },
    { patron: /\bdejá\b/i, nota: 'voseo: deja' },
    { patron: /\bbuscá\b/i, nota: 'voseo: busca' },
    { patron: /\bagregá\b/i, nota: 'voseo: agrega' },
    { patron: /\bsumá\b/i, nota: 'voseo: suma' },
    { patron: /\babrí\b/i, nota: 'voseo: abre' },
    { patron: /\bguardá\b/i, nota: 'voseo: guarda' },
    { patron: /\bborrá\b/i, nota: 'voseo: borra' },
    { patron: /\beditá\b/i, nota: 'voseo: edita' },
    { patron: /\baceptá\b/i, nota: 'voseo: acepta' },
    { patron: /\bcancelá\b/i, nota: 'voseo: cancela' },
    { patron: /\bvolvé\b/i, nota: 'voseo: vuelve' },
    { patron: /\bentrá\b/i, nota: 'voseo: entra' },
    { patron: /\bsalí\b/i, nota: 'voseo: sal' },
    { patron: /\bempezá\b/i, nota: 'voseo: empieza' },
    { patron: /\bterminá\b/i, nota: 'voseo: termina' },
    { patron: /\bescribí\b/i, nota: 'voseo: escribe' },
    { patron: /\bseleccioná\b/i, nota: 'voseo: selecciona' },
    { patron: /\btocá\b/i, nota: 'voseo: toca' },
    { patron: /\brevisá\b/i, nota: 'voseo: revisa' },
    { patron: /\bconfirmá\b/i, nota: 'voseo: confirma' },
    { patron: /\bintentá\b/i, nota: 'voseo: intenta' },
    { patron: /\besperá\b/i, nota: 'voseo: espera' },
    { patron: /\brecordá\b/i, nota: 'voseo: recuerda' },
    { patron: /\btenés\b/i, nota: 'voseo: tienes' },
    { patron: /\bpodés\b/i, nota: 'voseo: puedes' },
    { patron: /\bquerés\b/i, nota: 'voseo: quieres' },
    { patron: /\bsabés\b/i, nota: 'voseo: sabes' },
    { patron: /\bhacé\b/i, nota: 'voseo: haz' },
    { patron: /\bvení\b/i, nota: 'voseo: ven' },
    { patron: /\bpasale\b/i, nota: 'voseo: pásale' },
    { patron: /\bdecile\b/i, nota: 'voseo: dile' },
    { patron: /\bcontame\b/i, nota: 'voseo: cuéntame' },
    { patron: /\bavisame\b/i, nota: 'voseo: avísame' },
    { patron: /\bmostrame\b/i, nota: 'voseo: muéstrame' },
    { patron: /\bsos\b/i, nota: 'voseo: eres' },
    { patron: /\bacá\b/i, nota: 'léxico: aquí' },
    { patron: /\ballá\b/i, nota: 'léxico: allí' },
    { patron: /\brecién\b/i, nota: 'léxico: solo/apenas' },
    { patron: /\bcelular\b/i, nota: 'léxico: móvil' },
    { patron: /\bcomputadora\b/i, nota: 'léxico: ordenador' },
    { patron: /\bplata\b/i, nota: 'léxico: dinero' },
    { patron: /\bpibe\b/i, nota: 'léxico: chico' },
    { patron: /\blaburo\b/i, nota: 'léxico: trabajo' },
    { patron: /\bguita\b/i, nota: 'léxico: dinero' },
];

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
 * espacios —incluidos los de varias líneas, que es el caso que se coló en el primer intento— y
 * después se quita el comentario de línea.
 *
 * Límite conocido: un `//` dentro de una cadena (una URL) recorta el resto de esa línea. Solo puede
 * producir un falso **negativo** en esa línea, nunca un falso positivo.
 */
function sinComentarios(fuente: string): string {
    // Los ficheros del repo llegan en CRLF, y en JavaScript `.` no coincide con `\r`: un
    // `/\/\/.*$/` no borra el comentario al final de una línea CRLF y el guardián acusaría
    // comentarios como si fueran copy. Por eso se normaliza primero y el patrón usa `[^\n]`, que
    // sí incluye el retorno de carro.
    const normalizada = fuente.replace(/\r\n/g, '\n');
    const sinBloque = normalizada.replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ' '));

    return sinBloque
        .split('\n')
        .map((linea) => linea.replace(/\/\/[^\n]*$/, (comentario) => ' '.repeat(comentario.length)))
        .join('\n');
}

describe('idioma de la interfaz: español de España', () => {
    it('ninguna línea de copy usa voseo ni léxico rioplatense', () => {
        const faltas: string[] = [];

        for (const relativo of RAICES.flatMap(ficherosDeCopy)) {
            const lineas = sinComentarios(readFileSync(path.join(RAIZ, relativo), 'utf8')).split('\n');

            lineas.forEach((linea, indice) => {
                for (const { patron, nota } of MARCAS) {
                    if (patron.test(linea)) {
                        faltas.push(`${relativo}:${indice + 1} → ${nota} · ${linea.trim().slice(0, 110)}`);
                    }
                }
            });
        }

        expect(faltas, `Copy fuera de es-ES:\n${faltas.join('\n')}`).toEqual([]);
    });

    it('los precios se formatean con el locale de España', () => {
        // Si alguien cambia el locale del formateador, esto lo dice con nombre y apellido: en es-ES
        // el decimal es coma y el símbolo va detrás.
        const fuente = readFileSync(path.join(RAIZ, 'lib/format-price.ts'), 'utf8');

        expect(fuente).toContain("new Intl.NumberFormat('es-ES'");
    });

    it('el documento declara el idioma de la interfaz', () => {
        const fuente = readFileSync(path.join(RAIZ, 'app/_layout.tsx'), 'utf8');

        expect(fuente).toContain("document.documentElement.lang = 'es-ES'");
    });
});
