"use client";

import React from 'react';

interface RevealModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupName: string;
    receiverName: string;
    receiverAvatar?: string;
}

export function RevealModal({ isOpen, onClose, groupName, receiverName, receiverAvatar }: RevealModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden transform animate-in zoom-in-95 duration-300 flex flex-col items-center p-8 relative">

                {/* Decorative background circles */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>

                <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg shadow-indigo-600/30 mb-6 relative animate-bounce">
                    🎁
                </div>

                <h2 className="text-2xl font-black text-zinc-900 dark:text-white text-center mb-2 leading-tight">
                    ¡Sorteo Realizado!
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-center text-sm mb-8 px-4">
                    Se ha realizado el Amigo Invisible en el grupo <span className="font-bold text-zinc-700 dark:text-zinc-200">{groupName}</span>.
                </p>

                <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 flex flex-col items-center mb-8">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Te ha tocado regalar a:</p>

                    <div className="w-24 h-24 rounded-full bg-white dark:bg-zinc-800 border-4 border-indigo-500 shadow-xl flex items-center justify-center mb-4 overflow-hidden">
                        {receiverAvatar && receiverAvatar.startsWith('http') ? (
                            <img src={receiverAvatar} alt={receiverName} className="w-full h-full object-cover" />
                        ) : receiverAvatar ? (
                            <span className="text-4xl">{receiverAvatar}</span>
                        ) : (
                            <span className="text-3xl font-black text-indigo-600">{receiverName.charAt(0).toUpperCase()}</span>
                        )}
                    </div>

                    <h3 className="text-xl font-black text-zinc-900 dark:text-white text-center">
                        {receiverName}
                    </h3>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    ¡Entendido!
                </button>

                <p className="mt-4 text-[10px] text-zinc-400 text-center">
                    Podrás volver a consultar este resultado en el detalle del grupo.
                </p>
            </div>
        </div>
    );
}
