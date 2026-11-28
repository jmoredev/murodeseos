import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Marco común de las pantallas de acceso: sin sesión todavía, así que no hay
 * barra de pestañas (`11-acceso.html`, fila 1: «Sin barra de pestañas»).
 *
 * `contentContainerStyle.flexGrow` deja que la columna se centre cuando la
 * pantalla es alta y que pueda desplazarse cuando el teclado la tapa; el
 * `ScrollView` nunca recorta el foco de un campo.
 */
export function AuthScreen({ children }: { children: React.ReactNode }) {
    return (
        <SafeAreaView className="flex-1 bg-surface">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {children}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

/**
 * Columna de lectura del móvil: márgenes laterales de 16 px (`--sp-7`, §3) y
 * un ancho máximo que es el de la tarjeta de escritorio, para que la línea no
 * se estire en una tablet.
 */
export function AuthColumn({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <View className={`w-full max-w-[448px] self-center px-4 pb-7 pt-4 ${className}`}>
            {children}
        </View>
    );
}
