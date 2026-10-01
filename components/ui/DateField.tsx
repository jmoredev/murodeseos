import React from 'react';
import { Platform, Text, TextInput, View } from 'react-native';

type DateFieldProps = {
    label: string;
    /** Date as YYYY-MM-DD, or '' for "no date". */
    value: string;
    onChange: (next: string) => void;
};

// Mirrors the neighbouring text inputs (bg-surface-container-highest,
// rounded-full, text-on-background) with the resolved theme hex values,
// because NativeWind classes on a raw DOM element are not guaranteed.
const webInputStyle = {
    width: '100%',
    padding: 16,
    borderRadius: 9999,
    backgroundColor: '#ecd8e0',
    color: '#4c212b',
    border: 'none',
    outline: 'none',
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 16,
} as const;

export function DateField({ label, value, onChange }: DateFieldProps) {
    return (
        <View>
            <Text className="text-sm font-sans-semibold text-on-background mb-2">{label}</Text>
            {Platform.OS === 'web' ? (
                // react-native-web overwrites `type` on TextInput, so on web we must
                // render a real DOM input to get the native date picker.
                React.createElement('input', {
                    type: 'date',
                    value,
                    'aria-label': label,
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
                    style: webInputStyle,
                })
            ) : (
                <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#4c212b88"
                    aria-label={label}
                    className="bg-surface-container-highest p-4 rounded-full text-on-background text-lg font-sans"
                />
            )}
        </View>
    );
}
