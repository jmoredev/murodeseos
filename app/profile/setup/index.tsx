import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DateField } from '@/components/ui/DateField';

export default function ProfileSetupPage() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('👤');
    const [birthDate, setBirthDate] = useState('');
    const [nameDay, setNameDay] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/login');
            }
        };
        checkUser();
    }, [router]);

    const handleSave = async () => {
        if (displayName.trim().length < 3) {
            setError('El nombre debe tener al menos 3 caracteres');
            return;
        }

        // Guard for the non-web path: the browser date input already guarantees
        // YYYY-MM-DD on web, but the native fallback is free text.
        const isValidDate = (value: string) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value);
        if (!isValidDate(birthDate) || !isValidDate(nameDay)) {
            setError('Las fechas deben tener el formato AAAA-MM-DD');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No se encontró el usuario');

            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    display_name: displayName.trim(),
                    avatar_url: selectedAvatar,
                    // Postgres date columns: empty must be null, never ''.
                    birth_date: birthDate === '' ? null : birthDate,
                    name_day: nameDay === '' ? null : nameDay,
                    updated_at: new Date().toISOString(),
                });

            if (updateError) throw updateError;

            router.replace('/');
        } catch (err: any) {
            console.error('Error in profile setup:', err);
            setError(err.message || 'Error al guardar el perfil');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <ScrollView className="flex-1 p-8" contentContainerStyle={{ justifyContent: 'center', minHeight: '100%' }}>
                <View className="items-center mb-10 pt-4">
                    <Text className="text-3xl font-display text-on-background text-center tracking-tight">¡Bienvenido!</Text>
                    <Text className="text-on-surface/65 text-center mt-3 px-4 font-sans">
                        Antes de empezar, dinos cómo quieres que te vean los demás.
                    </Text>
                </View>

                <View className="items-center mb-10">
                    <View className="w-28 h-28 bg-surface-container-low rounded-full items-center justify-center shadow-ambient">
                        <Text className="text-6xl">{selectedAvatar}</Text>
                    </View>
                    <View className="flex-row flex-wrap justify-center gap-3 mt-6 px-4">
                        {['👤', '😊', '😎', '🤓', '🥳', '😇', '🦸', '👨‍💻'].map((emoji) => (
                            <Pressable
                                key={emoji}
                                onPress={() => setSelectedAvatar(emoji)}
                                className={`p-2 rounded-xl ${selectedAvatar === emoji ? 'bg-primary/12 ring-2 ring-primary/30' : 'bg-surface-container-low'}`}
                            >
                                <Text className="text-2xl">{emoji}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-sm font-sans-semibold text-on-background mb-2">Tu nombre o apodo</Text>
                        <TextInput
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Ej: John Doe, El Mago..."
                            placeholderTextColor="#4c212b88"
                            className="bg-surface-container-highest p-4 rounded-full text-on-background text-lg font-sans"
                        />
                        <Text className="text-xs text-on-surface/45 mt-2 font-sans-bold uppercase tracking-wider ml-1">
                            Mínimo 3 caracteres
                        </Text>
                    </View>

                    <DateField
                        label="Tu cumpleaños (opcional)"
                        value={birthDate}
                        onChange={setBirthDate}
                    />

                    <View>
                        <DateField
                            label="Tu onomástico o día del santo (opcional)"
                            value={nameDay}
                            onChange={setNameDay}
                        />
                        <Text className="text-xs text-on-surface/45 mt-2 font-sans-bold uppercase tracking-wider ml-1">
                            Solo importan el día y el mes; el año no se tiene en cuenta
                        </Text>
                    </View>

                    {error ? (
                        <View className="bg-primary/10 p-4 rounded-xl ring-1 ring-primary/20">
                            <Text className="text-primary text-sm text-center font-sans-medium">{error}</Text>
                        </View>
                    ) : null}

                    <PrimaryButton
                        onPress={handleSave}
                        disabled={loading}
                        textClassName="text-on-primary font-sans-bold text-lg"
                        accessibilityLabel="Empezar a usar Muro de Deseos"
                    >
                        {loading ? 'Guardando...' : 'Empezar a usar Muro de Deseos'}
                    </PrimaryButton>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
