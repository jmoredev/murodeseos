import React from 'react';
import { Pressable, Text } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { LINK_BUTTON, LINK_BUTTON_TEXT } from './styles';

type AuthBackLinkProps = {
    /** Lo que hace volver: «Volver», «Iniciar sesión»… (`11 · .back`). */
    label: string;
    onPress: () => void;
    testID?: string;
};

/**
 * Vuelta de una pantalla de acceso: chevron + etiqueta, 48 px de alto y sin
 * subrayado (el subrayado es de los enlaces de acción, `11 · .back`).
 */
export function AuthBackLink({ label, onPress, testID }: AuthBackLinkProps) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            testID={testID}
            className="min-h-[48px] flex-row items-center gap-1 self-start rounded-[12px] pl-1 pr-3 active:opacity-70"
        >
            <AppIcon name="chevron-left" size={20} className="text-primary-dark" />
            <Text className="text-[17px] font-sans-bold text-primary-dark">{label}</Text>
        </Pressable>
    );
}

type AuthLinkProps = {
    label: string;
    onPress: () => void;
    testID?: string;
    className?: string;
};

/** Enlace de acción de una pantalla de acceso (`.link-btn`): 16 px, 700, subrayado. */
export function AuthLink({ label, onPress, testID, className = '' }: AuthLinkProps) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            testID={testID}
            className={`${LINK_BUTTON} ${className}`}
        >
            <Text className={LINK_BUTTON_TEXT}>{label}</Text>
        </Pressable>
    );
}
