import React, { useEffect, useState } from 'react';

export const SplashScreen: React.FC = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Small delay to trigger entry animations
        const timer = setTimeout(() => setShow(true), 50);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070b14] overflow-hidden">

            {/* Background glow effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-600/20 blur-[80px] rounded-full mix-blend-screen"></div>

            {/* Main Container */}
            <div className={`relative flex flex-col items-center transition-all duration-1000 ease-out ${show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-8'}`}>

                {/* Logo Shield / Icon */}
                <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-purple-500 blur-xl opacity-50 animate-pulse rounded-full"></div>
                    <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-3xl shadow-2xl flex items-center justify-center relative z-10 border border-white/10 rotate-3 transition-transform duration-700 hover:rotate-0">
                        <span className="material-icons-round text-5xl text-white drop-shadow-md">shield</span>
                    </div>
                    {/* Sparkles */}
                    <span className="material-icons-round absolute -top-4 -right-4 text-yellow-400 text-2xl animate-bounce delay-100">auto_awesome</span>
                    <span className="material-icons-round absolute -bottom-2 -left-4 text-purple-400 text-xl animate-bounce delay-300">auto_awesome</span>
                </div>

                {/* Brand Name */}
                <h1 className="text-4xl font-black text-white tracking-tight mb-2 drop-shadow-lg flex items-center gap-1">
                    KSA <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">App</span>
                </h1>

                {/* Subtitle */}
                <p className="text-blue-200/60 font-medium tracking-widest uppercase text-xs">
                    Laden & Synchroniseren...
                </p>
            </div>

            {/* Bottom Loading Indicator */}
            <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 transition-all duration-1000 delay-500 ease-out ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        </div>
    );
};
