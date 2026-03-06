import React, { useEffect, useState } from 'react';

export const SplashScreen: React.FC = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Delay to allow fade-in
        const timer = setTimeout(() => setShow(true), 50);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className={`fixed inset-0 z-[9999] bg-[#070b14] overflow-hidden transition-opacity duration-1000 ease-out ${show ? 'opacity-100' : 'opacity-0'}`}>
            <video
                src="/freedomSplashScreen.mp4"
                autoPlay
                muted
                playsInline
                loop
                className="w-full h-full object-cover"
            />

            {/* Optional Loading Indicator overlapping the video */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
                <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full shadow-lg border border-white/10">
                    <p className="text-white/80 font-medium tracking-widest uppercase text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Laden & Synchroniseren...
                    </p>
                </div>
            </div>
        </div>
    );
};
