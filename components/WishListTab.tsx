'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { WishlistCard, GiftItem, Priority } from './WishlistCard'

// --- Componentes Auxiliares (Iconos) ---
const Icons = {
    Link: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
    Image: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
    Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    Gift: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>,
    Fire: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.3-1.1 1-2 1-2z"></path></svg>,
    X: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
};

// --- 2. Componente: Input Dinámico de Links ---
interface DynamicLinkInputProps {
    links: string[];
    onChange: (links: string[]) => void;
}

function DynamicLinkInput({ links, onChange }: DynamicLinkInputProps) {
    const addLink = () => {
        onChange([...links, '']);
    };

    const removeLink = (index: number) => {
        const newLinks = links.filter((_, i) => i !== index);
        onChange(newLinks);
    };

    const updateLink = (index: number, value: string) => {
        const newLinks = [...links];
        newLinks[index] = value;
        onChange(newLinks);
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Enlaces de compra
            </label>

            {links.map((link, index) => (
                <div key={index} className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                            <Icons.Link />
                        </div>
                        <input
                            type="url"
                            value={link}
                            onChange={(e) => updateLink(index, e.target.value)}
                            placeholder="https://..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        title="Eliminar enlace"
                    >
                        <Icons.Trash />
                    </button>
                </div>
            ))}

            <button
                type="button"
                onClick={addLink}
                className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors w-fit"
            >
                <Icons.Plus />
                Añadir enlace
            </button>
        </div>
    );
}

// --- Componente Principal ---
interface WishListTabProps {
    userId: string;
}

export function WishListTab({ userId }: WishListTabProps) {
    const [items, setItems] = useState<GiftItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'price'>('name');

    // Form State
    const [formData, setFormData] = useState<Partial<GiftItem>>({});

    // Cargar items desde Supabase
    useEffect(() => {
        const fetchItems = async () => {
            if (!userId) return;

            try {
                const { data, error } = await supabase
                    .from('wishlist_items')
                    .select('*')
                    .eq('user_id', userId)
                    .order('title', { ascending: true }); // Ordenar por nombre por defecto

                if (error) throw error;

                // Mapear de snake_case (DB) a camelCase (Frontend)
                const mappedItems: GiftItem[] = (data || []).map(item => ({
                    id: item.id,
                    title: item.title,
                    links: item.links || [],
                    imageUrl: item.image_url,
                    price: item.price,
                    notes: item.notes,
                    priority: item.priority as Priority,
                    reservedBy: item.reserved_by
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

    // Ordenar items según la opción seleccionada
    const sortedItems = [...items].sort((a, b) => {
        if (sortBy === 'name') {
            return a.title.localeCompare(b.title);
        } else {
            // Ordenar por precio
            const priceA = typeof a.price === 'number' ? a.price : parseFloat(a.price || '0');
            const priceB = typeof b.price === 'number' ? b.price : parseFloat(b.price || '0');
            return priceA - priceB;
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
                price: ''
            });
        }
        setIsFormOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
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
                // is_reserved se mantiene igual si existe, o false por defecto en DB
            };

            if (editingItem) {
                // Actualizar
                const { error } = await supabase
                    .from('wishlist_items')
                    .update(itemData)
                    .eq('id', editingItem.id);

                if (error) throw error;

                // Actualizar estado local
                setItems(items.map(i => i.id === editingItem.id ? { ...i, ...formData } as GiftItem : i));
            } else {
                // Crear
                const { data, error } = await supabase
                    .from('wishlist_items')
                    .insert(itemData)
                    .select()
                    .single();

                if (error) throw error;

                // Añadir al estado local
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
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error('Error saving item:', error);
            alert('Error al guardar el deseo. Por favor, intenta de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (editingItem) {
            if (!confirm('¿Estás seguro de que quieres eliminar este deseo?')) return;

            setIsSaving(true);
            try {
                const { error } = await supabase
                    .from('wishlist_items')
                    .delete()
                    .eq('id', editingItem.id);

                if (error) throw error;

                setItems(items.filter(i => i.id !== editingItem.id));
                setIsFormOpen(false);
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('Error al eliminar el deseo.');
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">Cargando deseos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 pb-24">
            {/* Header */}
            <header className="mb-8 pt-4 max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Mi Lista de Deseos</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">¿Qué te gustaría recibir?</p>
                    </div>
                    <button
                        onClick={() => openForm()}
                        className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Icons.Plus />
                    </button>
                </div>

                {/* Sorting controls */}
                {items.length > 0 && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSortBy('name')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'name'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            Por nombre
                        </button>
                        <button
                            onClick={() => setSortBy('price')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'price'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            Por precio
                        </button>
                    </div>
                )}
            </header>

            {/* Grid de Tarjetas */}
            <div className="max-w-5xl mx-auto">
                {sortedItems.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {sortedItems.map(item => (
                            <WishlistCard
                                key={item.id}
                                item={item}
                                onClick={openForm}
                                isOwner={true} // Always owner in this view
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl text-zinc-400">
                            🎁
                        </div>
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Tu lista está vacía</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Añade cosas que te ilusionen.</p>
                    </div>
                )}
            </div>

            {/* Modal Formulario */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => !isSaving && setIsFormOpen(false)}
                    ></div>

                    <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                        <form onSubmit={handleSave} className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                                    {editingItem ? 'Editar Deseo' : 'Nuevo Deseo'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => !isSaving && setIsFormOpen(false)}
                                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    disabled={isSaving}
                                >
                                    <Icons.X />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Gestión de Imagen */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                        Imagen
                                    </label>
                                    <div className="flex gap-4 items-start">
                                        <div className="w-24 h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {formData.imageUrl ? (
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <Icons.Image />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <input
                                                type="url"
                                                placeholder="Pegar URL de imagen..."
                                                value={formData.imageUrl || ''}
                                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                                disabled={isSaving}
                                            />
                                            <div className="text-xs text-zinc-500">
                                                O selecciona de la galería (Simulado)
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Título */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                        Título <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title || ''}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        placeholder="¿Qué deseas?"
                                        disabled={isSaving}
                                    />
                                </div>

                                {/* Precio y Prioridad */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                            Precio Aprox.
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.price || ''}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Ej: 25.00"
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                            Prioridad
                                        </label>
                                        <select
                                            value={formData.priority || 'medium'}
                                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                                            className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                            disabled={isSaving}
                                        >
                                            <option value="low">Baja</option>
                                            <option value="medium">Media</option>
                                            <option value="high">Alta</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Enlaces Dinámicos */}
                                <DynamicLinkInput
                                    links={formData.links || []}
                                    onChange={(newLinks) => setFormData({ ...formData, links: newLinks })}
                                />

                                {/* Notas */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                        Notas
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={formData.notes || ''}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        placeholder="Talla, color, detalles..."
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                {editingItem && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="px-4 py-3 text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl font-medium transition-colors"
                                        disabled={isSaving}
                                    >
                                        <Icons.Trash />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => !isSaving && setIsFormOpen(false)}
                                    className="flex-1 px-4 py-3 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors"
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                                    disabled={isSaving}
                                >
                                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
