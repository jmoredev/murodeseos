import React from 'react';
import { Text, View } from 'react-native';
import { AppIcon, AppIconName } from '@/components/ui/AppIcon';

type AuthAlertProps = {
    /** Título que dice QUÉ ha pasado (`11 · .ac-alert-t`). */
    title: string;
    /** Explicación y qué hacer a continuación (`11 · .ac-alert-d`). */
    body?: string;
    variant?: 'error' | 'ok';
    icon?: AppIconName;
    role?: 'alert' | 'status';
    testID?: string;
    /** Para que el formulario pueda apuntar a él con `aria-describedby`. */
    nativeID?: string;
    className?: string;
};

const LOOKS = {
    error: {
        box: 'border-danger-line bg-danger-soft',
        text: 'text-danger-dark',
        icon: 'text-danger',
    },
    ok: {
        box: 'border-accent-line bg-accent-soft',
        text: 'text-accent-ink',
        icon: 'text-accent',
    },
} as const;

/**
 * Aviso de las pantallas de acceso: título + explicación, con icono a la
 * izquierda (`11 · .ac-alert`). El de error interrumpe (`role="alert"`); el de
 * éxito se anuncia sin cortar (`role="status"`).
 */
export function AuthAlert({
    title,
    body,
    variant = 'error',
    icon,
    role,
    testID,
    nativeID,
    className = '',
}: AuthAlertProps) {
    const look = LOOKS[variant];

    return (
        <View
            nativeID={nativeID}
            testID={testID}
            role={role ?? (variant === 'error' ? 'alert' : 'status')}
            className={`mt-4 flex-row items-start gap-[11px] rounded-[16px] border-2 p-3 ${look.box} ${className}`}
        >
            <AppIcon
                name={icon ?? (variant === 'ok' ? 'lock' : 'alert-triangle')}
                size={24}
                className={`mt-px ${look.icon}`}
                accessibilityElementsHidden
                importantForAccessibility="no"
            />
            <View className="flex-1">
                <Text className={`text-[17px] font-sans-bold leading-[1.3] ${look.text}`}>
                    {title}
                </Text>
                {body ? (
                    <Text className={`mt-0.5 text-[17px] font-sans leading-[1.35] ${look.text}`}>
                        {body}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}
