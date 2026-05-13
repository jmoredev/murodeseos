import React, { useState, useEffect, useRef, useTransition } from 'react'
import { View, Text, Pressable, TextInput, Modal, ActivityIndicator, ScrollView, Platform, Image, useWindowDimensions, KeyboardAvoidingView } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { circleGlyphTextBase, emojiInCircle } from '@/lib/circle-glyph-styles'
import { WishlistCard, GiftItem, Priority } from './WishlistCard'
import { notifyWishAdded, notifyWishDeletedByOwner } from '@/lib/notification-utils'
import { ConfirmModal } from './ConfirmModal'
import { useToast } from './Toast'
import { PrimaryButton } from '@/components/ui/PrimaryButton'

export interface WishListTabProps {
    userId: string;
}

export function WishListTab({ userId }: WishListTabProps) {
    const [items, setItems] = useState<GiftItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'price' | 'priority'>('name');
    const [userGroups, setUserGroups] = useState<{ id: string; name: string; icon: string }[]>([]);
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;
    const insets = useSafeAreaInsets();

    const [formData, setFormData] = useState<Partial<GiftItem>>({});
    const { showToast, ToastComponent } = useToast();
    const [itemToDelete, setItemToDelete] = useState<GiftItem | null>(null);
    const [isPending, startTransition] = useTransition();

    // Cargar items desde Supabase
    useEffect(() => {
        const fetchItems = async () => {
            if (!userId) return;

            try {
                // Parallelize wishlist items and group memberships fetching
                const [wishlistResult, groupsResult] = await Promise.all([
                    supabase
                        .from('wishlist_items')
                        .select('*')
                        .eq('user_id', userId)
                        .order('title', { ascending: true }),
                    supabase
                        .from('group_members')
                        .select('group_id, groups(id, name, icon)')
                        .eq('user_id', userId)
                ]);

                if (wishlistResult.error) throw wishlistResult.error;
                
                const data = wishlistResult.data;
                const groupsData = groupsResult.data;

                if (groupsData) {
                    const mappedGroups = groupsData.map((gm: any) => ({
                        id: gm.groups.id,
                        name: gm.groups.name,
                        icon: gm.groups.icon
                    }));
                    setUserGroups(mappedGroups);
                }

                const mappedItems: GiftItem[] = (data || []).map(item => ({
                    id: item.id,
                    title: item.title,
                    links: item.links || [],
                    imageUrl: item.image_url,
                    price: item.price,
                    notes: item.notes,
                    priority: item.priority as Priority,
                    reservedBy: item.reserved_by,
                    excludedGroupIds: item.excluded_group_ids || []
                }));

                setItems(mappedItems);
            } catch (error) {
                console.error('Error fetching wishlist items:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, [userId]);

    const sortedItems = [...items].sort((a, b) => {
        if (sortBy === 'name') {
            return a.title.localeCompare(b.title);
        } else if (sortBy === 'price') {
            const priceA = typeof a.price === 'number' ? a.price : parseFloat(a.price || '0');
            const priceB = typeof b.price === 'number' ? b.price : parseFloat(b.price || '0');
            return priceA - priceB;
        } else {
            const priorityValues = { high: 3, medium: 2, low: 1 };
            const priorityA = priorityValues[a.priority || 'medium'] || 2;
            const priorityB = priorityValues[b.priority || 'medium'] || 2;
            return priorityB - priorityA;
        }
    });

    const openForm = (item?: GiftItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({ ...item });
        } else {
            setEditingItem(null);
            setFormData({
                title: '',
                links: [],
                priority: 'medium',
                notes: '',
                price: '',
                excludedGroupIds: []
            });
        }
        setIsFormOpen(true);
    };

    const toggleExcludedGroup = (groupId: string) => {
        setFormData(prev => {
            const current = (prev.excludedGroupIds || []) as string[];
            const next = current.includes(groupId)
                ? current.filter(id => id !== groupId)
                : [...current, groupId];
            return { ...prev, excludedGroupIds: next };
        });
    };

    const pickWishImageFromLibrary = async () => {
        if (!userId) return;
        setIsUploading(true);
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                showToast('Necesitamos permiso para acceder a la galería.', 'error');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
            });
            if (result.canceled || !result.assets[0]) return;

            const asset = result.assets[0];
            const rawExt =
                asset.fileName?.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
            const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
            const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${safeExt}`;

            const res = await fetch(asset.uri);
            const blob = await res.blob();
            const contentType =
                asset.mimeType ||
                (safeExt === 'jpg' || safeExt === 'jpeg' ? 'image/jpeg' : `image/${safeExt}`);

            const { error } = await supabase.storage
                .from('wishlist-images')
                .upload(path, blob, { contentType, upsert: true });

            if (error) throw error;

            const { data } = supabase.storage.from('wishlist-images').getPublicUrl(path);
            setFormData((prev) => ({ ...prev, imageUrl: data.publicUrl }));
            showToast('Imagen añadida');
        } catch (err) {
            console.error(err);
            showToast('No se pudo subir la imagen.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.title || !userId) return;

        setIsSaving(true);
        try {
            const itemData = {
                user_id: userId,
                title: formData.title,
                links: formData.links || [],
                image_url: formData.imageUrl,
                price: formData.price,
                notes: formData.notes,
                priority: formData.priority || 'medium',
                excluded_group_ids: formData.excludedGroupIds || []
            };

            if (editingItem) {
                const { error } = await supabase
                    .from('wishlist_items')
                    .update(itemData)
                    .eq('id', editingItem.id);

                if (error) throw error;
                setItems(items.map(i => i.id === editingItem.id ? { ...i, ...formData } as GiftItem : i));
            } else {
                const { data, error } = await supabase
                    .from('wishlist_items')
                    .insert(itemData)
                    .select()
                    .single();

                if (error) throw error;
                const newItem: GiftItem = {
                    id: data.id,
                    title: data.title,
                    links: data.links || [],
                    imageUrl: data.image_url,
                    price: data.price,
                    notes: data.notes,
                    priority: data.priority as Priority,
                    reservedBy: data.reserved_by
                };
                setItems([newItem, ...items]);
                notifyWishAdded(userId, data.id, formData.excludedGroupIds || []);
            }
            setIsFormOpen(false);
            showToast(editingItem ? 'Deseo actualizado' : 'Deseo guardado');
        } catch (error) {
            console.error('Error saving item:', error);
            showToast('Error al guardar el deseo.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const executeDelete = async () => {
        if (!itemToDelete) return;
        setIsSaving(true);
        try {
            if (itemToDelete.reservedBy) {
                await notifyWishDeletedByOwner(
                    userId,
                    itemToDelete.reservedBy,
                    itemToDelete.title || ''
                );
            }
            const { error } = await supabase
                .from('wishlist_items')
                .delete()
                .eq('id', itemToDelete.id);

            if (error) throw error;
            setItems(items.filter(i => i.id !== itemToDelete.id));
            setIsFormOpen(false);
            showToast('Deseo eliminado');
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast('Error al eliminar el deseo.', 'error');
        } finally {
            setIsSaving(false);
            setItemToDelete(null);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center p-20">
                <ActivityIndicator size="large" color="#aa2c32" />
                <Text className="mt-4 text-on-surface/55 font-sans-medium">Cargando deseos...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 w-full max-w-full self-stretch p-4 pb-20">
            <View className="flex-row justify-between items-end mb-8 px-2">
                <View>
                    <Text className="text-3xl font-display text-on-background tracking-tight">Deseos</Text>
                    <Text className="text-on-surface/55 font-sans-bold uppercase text-[10px] tracking-widest mt-2">¿Qué te gustaría recibir?</Text>
                </View>
                <PrimaryButton
                    onPress={() => openForm()}
                    accessibilityLabel="Nuevo deseo"
                    variant="icon"
                    className="w-12 h-12 rounded-2xl"
                    textClassName="text-on-primary font-sans-bold text-2xl leading-none"
                >
                    +
                </PrimaryButton>
            </View>

            {items.length > 0 ? (
                <View
                    className="mb-8 px-2"
                    style={{
                        flexDirection: 'row',
                        width: '100%',
                        maxWidth: '100%',
                        gap: 6,
                        opacity: isPending ? 0.7 : 1,
                    }}
                >
                    {(['name', 'price', 'priority'] as const).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => {
                                startTransition(() => {
                                    setSortBy(type as any);
                                });
                            }}
                            accessibilityLabel={type === 'name' ? 'Ordenar por nombre' : type === 'price' ? 'Ordenar por precio' : 'Ordenar por prioridad'}
                            style={{ flex: 1, minWidth: 0 }}
                            className={`px-2 py-2.5 rounded-full items-center justify-center ${sortBy === type ? 'bg-primary shadow-ambient' : 'bg-surface-container-low'}`}
                        >
                            <Text
                                className={`text-center font-sans-bold uppercase ${isDesktop ? 'text-xs tracking-wider' : 'text-[10px] tracking-wide'} ${sortBy === type ? 'text-on-primary' : 'text-on-surface/55'}`}
                                numberOfLines={1}
                            >
                                {isDesktop
                                    ? type === 'name'
                                        ? 'Por Nombre'
                                        : type === 'price'
                                          ? 'Por Precio'
                                          : 'Por Prioridad'
                                    : type === 'name'
                                      ? 'Nombre'
                                      : type === 'price'
                                        ? 'Precio'
                                        : 'Prioridad'}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}

            <View className="w-full">
                {sortedItems.length > 0 ? (
                    <View className="flex-row flex-wrap -m-2">
                        {sortedItems.map(item => (
                            <View key={item.id} className="w-1/2 md:w-1/3 lg:w-1/4 p-2">
                                <WishlistCard
                                    item={item}
                                    onClick={openForm}
                                    isOwner={true}
                                    onDelete={(i) => setItemToDelete(i)}
                                />
                            </View>
                        ))}
                    </View>
                ) : (
                    <View className="items-center justify-center py-20 text-center">
                        <View className="w-24 h-24 bg-surface-container-low rounded-full items-center justify-center mb-6">
                            <Text style={emojiInCircle(40)}>🎁</Text>
                        </View>
                        <Text className="text-2xl font-display text-on-background mb-2">Tu lista está vacía</Text>
                        <Text className="text-on-surface/55 font-sans-medium">Añade cosas que te ilusionen.</Text>
                    </View>
                )}
            </View>

            {/* Form Modal */}
            <Modal
                visible={isFormOpen}
                animationType={isDesktop ? 'fade' : 'slide'}
                transparent={isDesktop}
                onRequestClose={() => !isSaving && setIsFormOpen(false)}
            >
                <View className={`flex-1 ${isDesktop ? 'items-center justify-center px-4 bg-on-surface/40' : 'bg-surface'}`}>
                    {isDesktop && <Pressable className="absolute inset-0" onPress={() => !isSaving && setIsFormOpen(false)} />}
                    <KeyboardAvoidingView
                        enabled={!isDesktop}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        className={isDesktop ? 'w-full max-w-lg' : 'flex-1 w-full min-w-0'}
                    >
                        <View
                            className={`bg-surface-container-lowest ${isDesktop ? 'w-full rounded-3xl p-8 shadow-ambient-lg max-h-[90%] overflow-hidden' : 'flex-1 min-w-0 w-full px-4 pt-12'}`}
                            style={
                                !isDesktop
                                    ? { paddingBottom: 12 + insets.bottom }
                                    : { maxHeight: '90%' }
                            }
                        >
                        {/* Mobile Header with Back Button */}
                        {!isDesktop && (
                            <View className="flex-row items-center mb-4 min-w-0">
                                <Pressable
                                    onPress={() => !isSaving && setIsFormOpen(false)}
                                    className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center mr-3 shrink-0"
                                >
                                    <Text className="text-on-surface font-sans-bold" style={circleGlyphTextBase}>
                                        ←
                                    </Text>
                                </Pressable>
                                <Text
                                    className="text-2xl font-display text-on-background shrink min-w-0 flex-1"
                                    numberOfLines={2}
                                >
                                    {editingItem ? 'Editar deseo' : 'Nuevo deseo'}
                                </Text>
                            </View>
                        )}
                        {isDesktop && (
                            <Text className="text-2xl font-display text-on-background mb-6">
                                {editingItem ? 'Editar deseo' : 'Nuevo deseo'}
                            </Text>
                        )}

                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            className={isDesktop ? 'space-y-6' : 'flex-1 min-h-0'}
                            contentContainerStyle={
                                isDesktop
                                    ? { paddingBottom: 8 }
                                    : { flexGrow: 1, width: '100%', maxWidth: '100%', paddingBottom: 16 }
                            }
                            showsVerticalScrollIndicator={false}
                        >
                            <View className="w-full min-w-0 max-w-full">
                            <View className="mb-4">
                                <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Título</Text>
                                <TextInput
                                    value={formData.title || ''}
                                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                                    placeholder="¿Qué deseas?"
                                    className="w-full min-w-0 px-4 py-3.5 rounded-2xl bg-surface-container-highest text-on-background font-sans-semibold"
                                />
                            </View>

                            {/* Exclusión de deseos por grupos (web): los e2e buscan `label` + `input[type="checkbox"]`. */}
                            {Platform.OS === 'web' && userGroups.length > 0 ? (
                                <View className="mb-4">
                                    <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Excluir de grupos</Text>
                                    <View>
                                        {userGroups.map(group => {
                                            const excluded = (formData.excludedGroupIds || []).includes(group.id);
                                            return (
                                                <label
                                                    key={group.id}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={excluded}
                                                        onChange={() => toggleExcludedGroup(group.id)}
                                                    />
                                                    <span>{group.name}</span>
                                                </label>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}

                            <View className="flex-row gap-3 mb-4 min-w-0 w-full">
                                <View className="flex-1 min-w-0">
                                    <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Precio (€)</Text>
                                    <TextInput
                                        value={formData.price?.toString() || ''}
                                        onChangeText={(text) => setFormData({ ...formData, price: text })}
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        className="w-full min-w-0 px-4 py-3.5 rounded-2xl bg-surface-container-highest text-on-background font-sans-semibold"
                                    />
                                </View>
                                <View className="flex-1 min-w-0">
                                    <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Prioridad</Text>
                                    <View className="flex-row gap-1.5 bg-surface-container-low p-1 rounded-2xl min-w-0">
                                        {[
                                            { key: 'low', label: 'Baja', color: 'text-tertiary' },
                                            { key: 'medium', label: 'Media', color: 'text-secondary' },
                                            { key: 'high', label: 'Alta', color: 'text-primary' },
                                        ].map((p) => (
                                            <Pressable
                                                key={p.key}
                                                onPress={() => setFormData({ ...formData, priority: p.key as any })}
                                                className={`flex-1 min-w-0 py-3 rounded-xl items-center justify-center ${formData.priority === p.key ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                                            >
                                                <Text
                                                    className={`text-[10px] font-sans-bold uppercase tracking-wide text-center ${formData.priority === p.key ? p.color : 'text-on-surface/40'}`}
                                                    numberOfLines={1}
                                                >
                                                    {p.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <View className="mb-4 min-w-0">
                                <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">
                                    Imagen
                                </Text>
                                {formData.imageUrl ? (
                                    <View className="mb-3 items-center">
                                        <Image
                                            source={{ uri: formData.imageUrl }}
                                            className="w-32 h-32 rounded-2xl bg-surface-container-low"
                                            resizeMode="cover"
                                            accessibilityLabel="Vista previa de la imagen del deseo"
                                        />
                                    </View>
                                ) : null}
                                <TextInput
                                    value={formData.imageUrl || ''}
                                    onChangeText={(text) => setFormData({ ...formData, imageUrl: text })}
                                    placeholder="https://..."
                                    className="w-full min-w-0 px-4 py-3.5 rounded-2xl bg-surface-container-highest text-on-background mb-3"
                                />
                                <PrimaryButton
                                    onPress={pickWishImageFromLibrary}
                                    disabled={isSaving || isUploading}
                                    className="rounded-2xl py-3 w-full min-w-0"
                                    textClassName="text-on-primary font-sans-bold text-sm"
                                    accessibilityLabel={isUploading ? 'Subiendo imagen' : 'Elegir imagen de la galería'}
                                >
                                    {isUploading ? 'Subiendo…' : 'Elegir de la galería'}
                                </PrimaryButton>
                            </View>

                            <View className="mb-6 min-w-0">
                                <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Notas</Text>
                                <TextInput
                                    value={formData.notes || ''}
                                    onChangeText={(text) => setFormData({ ...formData, notes: text })}
                                    placeholder="Talla, color, detalles..."
                                    multiline
                                    numberOfLines={3}
                                    className="w-full min-w-0 px-4 py-3.5 rounded-2xl bg-surface-container-highest text-on-background"
                                />
                            </View>
                            </View>
                        </ScrollView>

                        <View className={`flex-row gap-3 min-w-0 ${isDesktop ? 'mt-8' : 'pt-4 border-t border-outline-variant/15'}`}>
                            {isDesktop ? (
                                <Pressable
                                    onPress={() => setIsFormOpen(false)}
                                    className="flex-1 py-4 items-center"
                                >
                                    <Text className="text-primary font-sans-bold">Cancelar</Text>
                                </Pressable>
                            ) : null}
                            {editingItem ? (
                                <Pressable
                                    onPress={() => { setItemToDelete(editingItem); setIsFormOpen(false); }}
                                    accessibilityLabel="Eliminar deseo"
                                    className={`bg-primary py-4 rounded-full items-center justify-center shadow-ambient active:scale-[0.98] shrink-0 ${isDesktop ? 'px-6' : 'w-14'}`}
                                >
                                    {isDesktop ? (
                                        <Text className="text-on-primary font-sans-bold text-xs uppercase tracking-widest">Eliminar</Text>
                                    ) : (
                                        <Text style={{ fontSize: 20 }}>🗑️</Text>
                                    )}
                                </Pressable>
                            ) : null}
                            <PrimaryButton
                                onPress={handleSave}
                                disabled={isSaving || isUploading}
                                className={`min-w-0 ${isDesktop ? 'flex-[2]' : 'flex-1'}`}
                                textClassName="text-on-primary font-sans-bold text-base"
                                accessibilityLabel={isSaving ? 'Guardando deseo' : 'Guardar deseo'}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </PrimaryButton>
                        </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            <ConfirmModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={executeDelete}
                title="Eliminar deseo"
                message={`¿Estás seguro de que quieres eliminar este deseo?`}
                confirmText="Eliminar"
                isDestructive={true}
            />

            {ToastComponent}
        </View>
    );
}
