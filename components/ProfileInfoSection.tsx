import React from 'react';
import { View, Text } from 'react-native';

interface ProfileInfoSectionProps {
    profile: any;
    isDesktop?: boolean;
}

export function ProfileInfoSection({ profile, isDesktop }: ProfileInfoSectionProps) {
    if (!profile) return null;

    const sections = [
        { label: 'Talla Camiseta', value: profile.shirt_size, icon: '👕' },
        { label: 'Talla Pantalón', value: profile.pants_size, icon: '👖' },
        { label: 'Talla Calzado', value: profile.shoe_size, icon: '👟' },
        { label: 'Color Favorito', value: profile.favorite_color, icon: '🎨' },
        { label: 'Marcas Favoritas', value: profile.favorite_brands, icon: '🏷️' },
        { label: 'Sitio Web', value: profile.website, icon: '🌐', isLink: true },
    ].filter(s => s.value);

    if (sections.length === 0) {
        return (
            <View className="p-6 items-center">
                <Text className="text-on-surface/50 italic text-sm font-sans">Sin información de tallas disponible.</Text>
            </View>
        );
    }

    return (
        <View className={`${isDesktop ? 'bg-surface-container-low rounded-3xl p-6 shadow-ambient' : 'p-6'}`}>
            <View className="mb-6 pt-1">
                <Text className="text-on-surface/45 font-sans-bold uppercase text-[10px] tracking-widest mb-2">
                    Información de perfil
                </Text>
                <Text className="text-xl font-display text-on-background">Detalles y Tallas</Text>
            </View>

            <View className="gap-3">
                {sections.map((section, idx) => (
                    <View key={idx} className="flex-row items-center bg-surface-container-lowest p-4 rounded-lg shadow-ambient">
                        <View className="w-10 h-10 rounded-md bg-surface-container-low items-center justify-center mr-4">
                            <Text style={{ fontSize: 20 }}>{section.icon}</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-[10px] font-sans-bold text-on-surface/45 uppercase tracking-wider mb-0.5">
                                {section.label}
                            </Text>
                            <Text className="text-on-background font-sans-bold" numberOfLines={2}>
                                {section.value}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
