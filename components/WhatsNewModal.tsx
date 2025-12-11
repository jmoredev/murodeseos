'use client';

import { useEffect, useState } from 'react';
import { getLatestUpdate } from '@/lib/updates';
import packageJson from '@/package.json';

export default function WhatsNewModal() {
    const [isOpen, setIsOpen] = useState(false);
    const latestUpdate = getLatestUpdate();
    const currentVersion = packageJson.version;

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem('lastSeenVersion');

        // Show if user hasn't seen this version yet and it matches the current deployed version
        // or if they've never seen any version (new user/cleared cache)
        if (latestUpdate.version === currentVersion && lastSeenVersion !== currentVersion) {
            setIsOpen(true);
        }
    }, [latestUpdate.version, currentVersion]);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('lastSeenVersion', currentVersion);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 border-b border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 text-purple-400">
                            <span className="text-xl">✨</span>
                        </span>
                        <span className="text-xs font-medium text-white/40 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                            v{latestUpdate.version}
                        </span>
                    </div>
                    <h2 id="modal-title" className="text-2xl font-bold text-white mb-1">
                        Novedades
                    </h2>
                    <p className="text-sm text-gray-400">
                        Descubre lo nuevo en esta actualización
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                            Cambios Realizados
                        </h3>
                        <ul className="space-y-3">
                            {latestUpdate.changes.map((change, index) => (
                                <li key={index} className="flex items-start gap-3 text-gray-300">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                                    <span className="text-sm leading-relaxed">{change}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="px-6 py-2.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-sm shadow-lg shadow-white/5"
                    >
                        ¡Entendido!
                    </button>
                </div>
            </div>
        </div>
    );
}
