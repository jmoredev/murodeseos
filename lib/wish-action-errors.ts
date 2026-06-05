import { WishReservationError } from '@/lib/wish-reservation';

export function getWishActionErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof WishReservationError) return err.message;
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
        const message = (err as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return message;
    }
    return fallback;
}
