/**
 * React Native Web implementa varias propiedades `accessibility*` que los tipos de
 * React Native no declaran. La aplicación usa dos de ellas en los formularios de
 * acceso para señalar el campo con error y el texto que lo describe.
 *
 * Esta ampliación solo describe lo que el destino web soporta de verdad; no añade
 * comportamiento. Si dejan de usarse, este archivo sobra.
 */
import 'react-native';

declare module 'react-native' {
    interface AccessibilityProps {
        /** Solo web: React Native Web lo traduce a `aria-invalid`. */
        accessibilityInvalid?: boolean;
        /** Solo web: React Native Web lo traduce a `aria-describedby`. */
        accessibilityDescribedBy?: string;
    }
}
