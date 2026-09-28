import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/password';

describe('validateNewPassword', () => {
    it('acepta justo el mínimo', () => {
        expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    });

    it('rechaza un carácter menos que el mínimo', () => {
        expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/al menos 8 caracteres/);
    });

    it('nombra el mínimo en el mensaje, en vez de repetir el número', () => {
        const message = validateNewPassword('');

        expect(message).toContain(String(MIN_PASSWORD_LENGTH));
    });

    it('rechaza la contraseña vacía', () => {
        expect(validateNewPassword('')).not.toBeNull();
    });
});
