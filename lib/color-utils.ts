export const colorMap: Record<string, string> = {
    'azul': '#3b82f6', // indigo-500
    'rojo': '#ef4444', // red-500
    'negro': '#000000',
    'blanco': '#ffffff',
    'verde': '#22c55e', // green-500
    'amarillo': '#eab308', // yellow-500
    'rosa': '#ec4899', // pink-500
    'gris': '#71717a', // zinc-500
    'naranja': '#f97316', // orange-500
    'morado': '#a855f7', // purple-500
    'cian': '#06b6d4', // cyan-500
    'marrón': '#78350f', // amber-900 (brownish)
    'marron': '#78350f',
    'turquesa': '#14b8a6', // teal-500
    'dorado': '#fbbf24', // amber-400
    'plateado': '#cbd5e1', // slate-300
    'lima': '#84cc16', // lime-500
    'coral': '#fb7185', // rose-400
    'azul marino': '#1e3a8a', // blue-900
    'verde oliva': '#365314', // lime-900
    'burdeos': '#7f1d1d', // red-900
    'beige': '#f5f5dc',
    'gris carbón': '#27272a', // zinc-800
    'gris carbon': '#27272a',
    'púrpura': '#7e22ce', // purple-700
    'purpura': '#7e22ce',
    'lavanda': '#e879f9', // fuchsia-400
    'verde bosque': '#14532d', // green-900
    'azul cielo': '#7dd3fc', // sky-300
    'chocolate': '#451a03', // orange-950
};

export function getCssColor(colorName?: string): string {
    if (!colorName) return 'transparent';
    const normalized = colorName.toLowerCase().trim();

    // Check if it's already a valid CSS color format
    if (normalized.startsWith('#') || normalized.startsWith('rgb') || normalized.startsWith('hsl')) {
        return normalized;
    }

    // Try to map from Spanish to CSS/Hex
    return colorMap[normalized] || normalized;
}
