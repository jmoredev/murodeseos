import React, { useState, useEffect, useRef, useTransition } from 'react'
import { View, Text, Pressable, TextInput, Modal, ActivityIndicator, ScrollView, Platform, Image, useWindowDimensions } from 'react-native'
import { supabase } from '@/lib/supabase'
import { WishlistCard, GiftItem, Priority } from './WishlistCard'
import { notifyWishAdded } from '@/lib/notification-utils'
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
        <View className="flex-1 p-4 pb-20">
            <View className="flex-row justify-between items-end mb-8 px-2">
                <View>
                    <Text className="text-3xl font-display text-on-background tracking-tight">Deseos</Text>
                    <Text className="text-on-surface/55 font-sans-bold uppercase text-[10px] tracking-widest mt-2">¿Qué te gustaría recibir?</Text>
                </View>
                <PrimaryButton
                    onPress={() => openForm()}
                    accessibilityLabel="Nuevo deseo"
                    className="w-12 h-12 rounded-2xl"
                    textClassName="text-on-primary font-display text-2xl"
                >
                    +
                </PrimaryButton>
            </View>

            {items.length > 0 ? (
                <View className="flex-row gap-2 mb-8 px-2 overflow-auto no-scrollbar" style={{ opacity: isPending ? 0.7 : 1 }}>
                    {['name', 'price', 'priority'].map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => {
                                startTransition(() => {
                                    setSortBy(type as any);
                                });
                            }}
                            accessibilityLabel={type === 'name' ? 'Ordenar por nombre' : type === 'price' ? 'Ordenar por precio' : 'Ordenar por prioridad'}
                            className={`px-4 py-2 rounded-full ${sortBy === type ? 'bg-primary shadow-ambient' : 'bg-surface-container-low'}`}
                        >
                            <Text className={`text-xs font-sans-bold uppercase tracking-wider ${sortBy === type ? 'text-on-primary' : 'text-on-surface/55'}`}>
                                {type === 'name' ? 'Por Nombre' : type === 'price' ? 'Por Precio' : 'Por Prioridad'}
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
                            <Text style={{ fontSize: 40 }}>🎁</Text>
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
                    <View className={`bg-surface-container-lowest ${isDesktop ? 'w-full max-w-lg rounded-3xl p-8 shadow-ambient-lg overflow-scroll max-h-[90%]' : 'flex-1 p-6 pt-14'}`}>
                        {/* Mobile Header with Back Button */}
                        {!isDesktop && (
                            <View className="flex-row items-center mb-6">
                                <Pressable
                                    onPress={() => !isSaving && setIsFormOpen(false)}
                                    className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center mr-4"
                                >
                                    <Text className="text-on-surface font-sans-bold">←</Text>
                                </Pressable>
                                <Text className="text-2xl font-display text-on-background">
                                    {editingItem ? 'Editar deseo' : 'Nuevo deseo'}
                                </Text>
                            </View>
                        )}
                        {isDesktop && (
                            <Text className="text-2xl font-display text-on-background mb-6">
                                {editingItem ? 'Editar deseo' : 'Nuevo deseo'}
                            </Text>
                        )}

                        <ScrollView className="space-y-6">
                            <View className="mb-4">
                                <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Título</Text>
                                <TextInput
                                    value={formData.title || ''}
                                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                                    placeholder="¿Qué deseas?"
                                    className="w-full px-4 py-4 rounded-full bg-surface-container-highest text-on-background font-sans-semibold"
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

                            <View className="flex-row gap-4 mb-4">
                                <View className="flex-1">
                                    <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Precio (€)</Text>
                                    <TextInput
                                        value={formData.price?.toString() || ''}
                                        onChangeText={(text) => setFormData({ ...formData, price: text })}
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        className="w-full px-4 py-4 rounded-full bg-surface-container-highest text-on-background font-sans-semibold"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Prioridad</Text>
                                    <View className="flex-row gap-2 bg-surface-container-low p-1 rounded-full">
                                        {[
                                            { key: 'low', label: 'Baja', color: 'text-tertiary' },
                                            { key: 'medium', label: 'Media', color: 'text-secondary' },
                                            { key: 'high', label: 'Alta', color: 'text-primary' },
                                        ].map((p) => (
                                            <Pressable
                                                key={p.key}
                                                onPress={() => setFormData({ ...formData, priority: p.key as any })}
                                                className={`flex-1 py-3 rounded-full items-center ${formData.priority === p.key ? 'bg-surface-container-lowest shadow-ambient' : ''}`}
                                            >
                                                <Text className={`text-xs font-sans-bold uppercase tracking-wider ${formData.priority === p.key ? p.color : 'text-on-surface/40'}`}>
                                                    {p.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <View className="mb-4">
                                <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">URL Imagen</Text>
                                <TextInput
                                    value={formData.imageUrl || ''}
                                    onChangeText={(text) => setFormData({ ...formData, imageUrl: text })}
                                    placeholder="https://..."
                                    className="w-full px-4 py-4 rounded-full bg-surface-container-highest text-on-background"
                                />
                            </View>

                            <View className="mb-8">
                                <Text className="text-xs font-sans-bold text-on-surface/45 uppercase tracking-widest mb-2">Notas</Text>
                                <TextInput
                                    value={formData.notes || ''}
                                    onChangeText={(text) => setFormData({ ...formData, notes: text })}
                                    placeholder="Talla, color, detalles..."
                                    multiline
                                    numberOfLines={3}
                                    className="w-full px-4 py-4 rounded-2xl bg-surface-container-highest text-on-background"
                                />
                            </View>
                        </ScrollView>

                        <View className={`flex-row gap-3 ${isDesktop ? 'mt-8' : 'mt-auto pt-6'}`}>
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
                                    className={`bg-primary py-4 rounded-full items-center justify-center shadow-ambient active:scale-[0.98] ${isDesktop ? 'px-6' : 'w-14'}`}
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
                                disabled={isSaving}
                                className={isDesktop ? 'flex-[2]' : 'flex-1'}
                                textClassName="text-on-primary font-sans-bold text-base"
                                accessibilityLabel={isSaving ? 'Guardando deseo' : 'Guardar deseo'}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </PrimaryButton>
                        </View>
                    </View>
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
