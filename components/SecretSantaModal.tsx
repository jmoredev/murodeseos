"use client";

import React, { useState, useEffect } from 'react';
import { Group, GroupMember } from './GroupCard';
import { getExclusions, addExclusion, removeExclusion, performDraw, endDraw } from '@/lib/draw-utils';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './Toast';

interface SecretSantaModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: Group;
    adminId: string;
    isDrawActive: boolean;
    onDrawStatusChange: () => void;
}

export function SecretSantaModal({ isOpen, onClose, group, adminId, isDrawActive, onDrawStatusChange }: SecretSantaModalProps) {
    const [exclusions, setExclusions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [userA, setUserA] = useState("");
    const [userB, setUserB] = useState("");

    const { showToast, ToastComponent } = useToast();
    const [pendingConfirm, setPendingConfirm] = useState<{
        type: 'launch' | 'end';
        title: string;
        message: string;
    } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchExclusions();
        }
    }, [isOpen, group.id]);

    const fetchExclusions = async () => {
        try {
            const data = await getExclusions(group.id);
            setExclusions(data);
        } catch (error) {
            console.error('Error fetching exclusions:', error);
        }
    };

    const handleAddExclusion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userA || !userB || userA === userB) return;

        setLoading(true);
        try {
            await addExclusion(group.id, userA, userB);
            setUserA("");
            setUserB("");
            await fetchExclusions();
            showToast('Exclusión añadida correctamente');
        } catch (error) {
            showToast('Error al añadir exclusión: ' + (error as any).message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveExclusion = async (id: string) => {
        try {
            await removeExclusion(id);
            await fetchExclusions();
            showToast('Exclusión eliminada');
        } catch (error) {
            showToast('Error al eliminar exclusión', 'error');
        }
    };

    const handleLaunchDraw = async () => {
        if (isDrawActive) {
            setPendingConfirm({
                type: 'launch',
                title: 'Nuevo Sorteo',
                message: 'Ya hay un sorteo activo. ¿Deseas realizar uno nuevo? Se borrarán los resultados anteriores.'
            });
            return;
        }
        executeLaunch();
    };

    const executeLaunch = async () => {
        setLoading(true);
        try {
            await performDraw(group.id, adminId);
            showToast('¡Sorteo realizado con éxito! Todos han sido notificados');
            onDrawStatusChange();
            // Delay a bit to show toast before closing
            setTimeout(onClose, 1500);
        } catch (error) {
            showToast('Error al realizar el sorteo: ' + (error as any).message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEndDraw = async () => {
        setPendingConfirm({
            type: 'end',
            title: 'Finalizar Sorteo',
            message: '¿Estás seguro de que deseas finalizar el Amigo Invisible? Se borrarán todas las asignaciones actuales.'
        });
    };

    const executeEnd = async () => {
        setLoading(true);
        try {
            await endDraw(group.id, adminId);
            showToast('Amigo Invisible finalizado');
            onDrawStatusChange();
            setTimeout(onClose, 1500);
        } catch (error) {
            showToast('Error al finalizar el sorteo', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const getMemberName = (id: string) => group.members.find(m => m.id === id)?.name || 'Usuario';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span>🎁</span> Amigo Invisible
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Configura las reglas y lanza el sorteo</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Status Section */}
                    <div className={`p-4 rounded-2xl flex items-center gap-4 ${isDrawActive ? 'bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20' : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20'}`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${isDrawActive ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                            {isDrawActive ? '✅' : '⏳'}
                        </div>
                        <div>
                            <p className="font-bold text-zinc-900 dark:text-white">
                                {isDrawActive ? 'El sorteo está activo' : 'El sorteo no ha comenzado'}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {isDrawActive ? 'Los participantes ya pueden ver a quién les toca regalar.' : 'Configura las exclusiones antes de empezar.'}
                            </p>
                        </div>
                    </div>

                    {/* Exclusions Section */}
                    <section>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center text-[10px]">🚫</span>
                            Exclusiones (Parejas que no pueden regalarse)
                        </h3>

                        <form onSubmit={handleAddExclusion} className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="sm:col-span-2">
                                <select
                                    value={userA}
                                    onChange={(e) => setUserA(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    required
                                >
                                    <option value="">Seleccionar miembro...</option>
                                    {group.members.map(m => (
                                        <option key={m.id} value={m.id} disabled={m.id === userB}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center justify-center text-zinc-400 font-bold">↔️</div>
                            <div className="sm:col-span-2">
                                <select
                                    value={userB}
                                    onChange={(e) => setUserB(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    required
                                >
                                    <option value="">Seleccionar miembro...</option>
                                    {group.members.map(m => (
                                        <option key={m.id} value={m.id} disabled={m.id === userA}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !userA || !userB}
                                className="sm:col-span-1 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </form>

                        <div className="space-y-2">
                            {exclusions.length > 0 ? (
                                exclusions.map((ex) => (
                                    <div key={ex.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl group">
                                        <div className="flex items-center gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                                            <span>{getMemberName(ex.user_a_id)}</span>
                                            <span className="text-zinc-400">no puede regalar a</span>
                                            <span>{getMemberName(ex.user_b_id)}</span>
                                            <span className="text-[10px] text-zinc-400 italic">(y viceversa)</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveExclusion(ex.id)}
                                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Eliminar exclusión"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-6 text-zinc-400 text-sm italic border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl">
                                    No hay exclusiones configuradas. Todos pueden regalar a todos.
                                </p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-3">
                    {isDrawActive ? (
                        <button
                            onClick={handleEndDraw}
                            disabled={loading}
                            className="flex-1 py-3 px-4 rounded-2xl border border-red-200 dark:border-red-900/30 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                            Finalizar Amigo Invisible
                        </button>
                    ) : null}

                    <button
                        onClick={handleLaunchDraw}
                        disabled={loading || group.members.length < 2}
                        className={`flex-[2] py-3 px-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            }`}
                    >
                        {loading && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        )}
                        {isDrawActive ? 'Volver a realizar sorteo' : 'Realizar Sorteo Ahora'}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!pendingConfirm}
                onClose={() => setPendingConfirm(null)}
                onConfirm={() => {
                    if (pendingConfirm?.type === 'launch') executeLaunch();
                    if (pendingConfirm?.type === 'end') executeEnd();
                }}
                title={pendingConfirm?.title || ''}
                message={pendingConfirm?.message || ''}
                confirmText={pendingConfirm?.type === 'launch' ? 'Realizar Sorteo' : 'Finalizar'}
                isDestructive={pendingConfirm?.type === 'end'}
            />

            {ToastComponent}
        </div>
    );
}
