import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Página no encontrada' }} />
            <View style={styles.container}>
                <Text style={styles.title}>Esta página no existe.</Text>
                <Link href="/" style={styles.link}>
                    <Text style={styles.linkText}>Volver a la pantalla de inicio</Text>
                </Link>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        // Tokens canónicos (sistema-nuevo.md §1): --bg, --ink y --primary-dark.
        backgroundColor: '#FFF8F1',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2B1A12',
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
    },
    linkText: {
        fontSize: 14,
        color: '#8F2E0C',
        fontWeight: '600',
    },
});
