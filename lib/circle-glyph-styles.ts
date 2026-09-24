import { Platform, TextStyle } from 'react-native';

/** Alineación vertical de texto/emojis dentro de contenedores circulares (sobre todo Android). */
export const circleGlyphTextBase: TextStyle = {
    textAlign: 'center',
    ...(Platform.OS === 'android'
        ? { includeFontPadding: false, textAlignVertical: 'center' }
        : {}),
};

/** Emoji o carácter único centrado en un círculo de tamaño ~fontSize. */
export function emojiInCircle(fontSize: number): TextStyle {
    return {
        ...circleGlyphTextBase,
        fontSize,
        lineHeight: fontSize,
    };
}
