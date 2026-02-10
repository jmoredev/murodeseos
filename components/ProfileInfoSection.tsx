import React from 'react';
import { View, Text, ScrollView } from 'react-native';

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
                <Text className="text-zinc-400 italic text-sm">Sin información de tallas disponible.</Text>
            </View>
        );
    }

    return (
        <View className={`${isDesktop ? 'bg-zinc-50 border border-zinc-100 rounded-3xl p-6' : 'p-6'}`}>
            <View className="mb-6">
                <Text className="text-zinc-400 font-black uppercase text-[10px] tracking-widest mb-1">
                    Información de Perfil
                </Text>
                <Text className="text-xl font-black text-zinc-900">Detalles y Tallas</Text>
            </View>

            <View className="space-y-4">
                {sections.map((section, idx) => (
                    <View key={idx} className="flex-row items-center bg-white border border-zinc-100 p-4 rounded-2xl shadow-sm">
                        <View className="w-10 h-10 rounded-xl bg-zinc-50 items-center justify-center mr-4">
                            <Text style={{ fontSize: 20 }}>{section.icon}</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                {section.label}
                            </Text>
                            <Text className="text-zinc-900 font-bold" numberOfLines={2}>
                                {section.value}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
