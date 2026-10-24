import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DateField } from '@/components/ui/DateField';

/**
 * Alta del usuario nuevo, en dos pasos: primero quién eres, después qué te gusta.
 *
 * El nombre es el **único** dato obligatorio: es lo que el login y la portada miran
 * para decidir si el usuario ya pasó por aquí (`app/(auth)/login/index.tsx`). Las
 * tallas y el estilo existen para que los demás acierten con el regalo —se muestran
 * en `ProfileInfoSection` al abrir un deseo ajeno—, así que se piden en el mismo
 * alta pero nunca bloquean la entrada: el segundo paso se puede completar o dejar
 * para después desde «Mi perfil».
 *
 * Un solo `upsert` al final: mientras no se guarde, el perfil sigue sin nombre y la
 * app vuelve a este alta, que es justo el estado que se quiere.
 */
export default function ProfileSetupPage() {
    const router = useRouter();
    const [step, setStep] = useState<'identity' | 'style'>('identity');
    const [displayName, setDisplayName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('👤');
    const [birthDate, setBirthDate] = useState('');
    const [nameDay, setNameDay] = useState('');
    const [shirtSize, setShirtSize] = useState('');
    const [pantsSize, setPantsSize] = useState('');
    const [shoeSize, setShoeSize] = useState('');
    const [favoriteBrands, setFavoriteBrands] = useState('');
    const [favoriteColor, setFavoriteColor] = useState('');
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

    // Las columnas de Postgres esperan NULL, nunca cadena vacía.
    const orNull = (value: string) => {
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    };

    const isValidDate = (value: string) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value);

    const handleContinue = () => {
        if (displayName.trim().length < 3) {
            setError('El nombre debe tener al menos 3 caracteres');
            return;
        }

        // Guard for the non-web path: the browser date input already guarantees
        // YYYY-MM-DD on web, but the native fallback is free text.
        if (!isValidDate(birthDate) || !isValidDate(nameDay)) {
            setError('Las fechas deben tener el formato AAAA-MM-DD');
            return;
        }

        setError('');
        setStep('style');
    };

    const handleSave = async () => {
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
                    birth_date: orNull(birthDate),
                    name_day: orNull(nameDay),
                    shirt_size: orNull(shirtSize),
                    pants_size: orNull(pantsSize),
                    shoe_size: orNull(shoeSize),
                    favorite_brands: orNull(favoriteBrands),
                    favorite_color: orNull(favoriteColor),
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
                <View className="items-center mb-2">
                    <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-[0.2em]">
                        {step === 'identity' ? 'Paso 1 de 2' : 'Paso 2 de 2'}
                    </Text>
                </View>

                {step === 'identity' ? (
                    <View className="items-center mb-10 pt-4">
                        <Text className="text-3xl font-display text-on-background text-center tracking-tight">¡Bienvenido!</Text>
                        <Text className="text-on-surface/70 text-center mt-3 px-4 font-sans">
                            Antes de empezar, dinos cómo quieres que te vean los demás.
                        </Text>
                    </View>
                ) : (
                    <View className="items-center mb-10 pt-4">
                        <Text className="text-3xl font-display text-on-background text-center tracking-tight">
                            Qué te gusta
                        </Text>
                        <Text className="text-on-surface/70 text-center mt-3 px-4 font-sans">
                            Con esto tus amigos aciertan con el regalo. Es opcional: puedes completarlo cuando quieras
                            desde «Mi perfil».
                        </Text>
                    </View>
                )}

                {step === 'identity' ? (
                    <>
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
                                    testID="setup-name-input"
                                    className="bg-surface-container-highest p-4 rounded-full text-on-background text-lg font-sans"
                                />
                                <Text className="text-xs text-on-surface/70 mt-2 font-sans-bold uppercase tracking-wider ml-1">
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
                                <Text className="text-xs text-on-surface/70 mt-2 font-sans-bold uppercase tracking-wider ml-1">
                                    Solo importan el día y el mes; el año no se tiene en cuenta
                                </Text>
                            </View>

                            {error ? (
                                <View className="bg-primary/10 p-4 rounded-xl ring-1 ring-primary/20">
                                    <Text className="text-primary text-sm text-center font-sans-medium">{error}</Text>
                                </View>
                            ) : null}

                            <PrimaryButton
                                onPress={handleContinue}
                                testID="setup-continue-button"
                                textClassName="text-on-primary font-sans-bold text-lg"
                                accessibilityLabel="Continuar al paso de tallas y estilo"
                            >
                                Continuar
                            </PrimaryButton>
                        </View>
                    </>
                ) : (
                    <View className="space-y-6">
                        <View className="pt-2 pb-6 bg-surface-container-low -mx-2 px-4 rounded-2xl">
                            <Text className="text-xs font-sans-bold text-primary uppercase tracking-[0.3em] mb-6">Tallas</Text>

                            <View className="flex-row gap-4 mb-4">
                                <View className="flex-1">
                                    <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-2 ml-1">
                                        Camiseta
                                    </Text>
                                    <TextInput
                                        value={shirtSize}
                                        onChangeText={setShirtSize}
                                        placeholder="M, L, XL..."
                                        placeholderTextColor="#4c212b88"
                                        testID="setup-shirt-input"
                                        className="bg-surface-container-highest p-4 rounded-full text-on-background font-sans"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-2 ml-1">
                                        Pantalón
                                    </Text>
                                    <TextInput
                                        value={pantsSize}
                                        onChangeText={setPantsSize}
                                        placeholder="42, 32..."
                                        placeholderTextColor="#4c212b88"
                                        testID="setup-pants-input"
                                        className="bg-surface-container-highest p-4 rounded-full text-on-background font-sans"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-2 ml-1">
                                    Calzado
                                </Text>
                                <TextInput
                                    value={shoeSize}
                                    onChangeText={setShoeSize}
                                    placeholder="Ej: 43..."
                                    placeholderTextColor="#4c212b88"
                                    testID="setup-shoes-input"
                                    className="bg-surface-container-highest p-4 rounded-full text-on-background font-sans"
                                />
                            </View>
                        </View>

                        <View className="pb-2">
                            <Text className="text-xs font-sans-bold text-primary uppercase tracking-[0.3em] mb-6">Estilo</Text>

                            <View className="mb-4">
                                <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-2 ml-1">
                                    Marcas favoritas
                                </Text>
                                <TextInput
                                    value={favoriteBrands}
                                    onChangeText={setFavoriteBrands}
                                    placeholder="Nike, Zara..."
                                    placeholderTextColor="#4c212b88"
                                    testID="setup-brands-input"
                                    className="bg-surface-container-highest p-4 rounded-full text-on-background font-sans"
                                />
                            </View>

                            <View>
                                <Text className="text-xs font-sans-bold text-on-surface/70 uppercase tracking-widest mb-2 ml-1">
                                    Color favorito
                                </Text>
                                <TextInput
                                    value={favoriteColor}
                                    onChangeText={setFavoriteColor}
                                    placeholder="Azul, verde..."
                                    placeholderTextColor="#4c212b88"
                                    testID="setup-color-input"
                                    className="bg-surface-container-highest p-4 rounded-full text-on-background font-sans"
                                />
                            </View>
                        </View>

                        {error ? (
                            <View className="bg-primary/10 p-4 rounded-xl ring-1 ring-primary/20">
                                <Text className="text-primary text-sm text-center font-sans-medium">{error}</Text>
                            </View>
                        ) : null}

                        <PrimaryButton
                            onPress={handleSave}
                            disabled={loading}
                            testID="setup-save-button"
                            textClassName="text-on-primary font-sans-bold text-lg"
                            accessibilityLabel="Empezar a usar Muro de Deseos"
                        >
                            {loading ? 'Guardando...' : 'Empezar a usar Muro de Deseos'}
                        </PrimaryButton>

                        <Pressable
                            onPress={handleSave}
                            disabled={loading}
                            accessibilityRole="button"
                            accessibilityLabel="Completar más tarde"
                            accessibilityState={{ disabled: loading }}
                            testID="setup-skip-button"
                            className={`items-center py-3 ${loading ? 'opacity-50' : ''}`}
                        >
                            <Text className="text-on-surface/70 font-sans-bold text-sm underline">Completar más tarde</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => setStep('identity')}
                            disabled={loading}
                            accessibilityRole="button"
                            accessibilityLabel="Volver al paso anterior"
                            accessibilityState={{ disabled: loading }}
                            testID="setup-back-button"
                            className={`items-center py-1 ${loading ? 'opacity-50' : ''}`}
                        >
                            <Text className="text-on-surface/70 font-sans-bold text-xs uppercase tracking-widest">
                                Volver
                            </Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
