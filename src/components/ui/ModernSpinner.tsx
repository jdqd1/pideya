import { useEffect, useState } from 'react';

type ModernSpinnerProps = {
    /** 
     * If true, fills the parent container and centers the spinner.
     * If false, renders inline.
     */
    container?: boolean;
    /**
     * Optional text to display below the spinner
     */
    text?: string;
    /**
     * Scale factor for the spinner size (default 1)
     */
    scale?: number;
};

export default function ModernSpinner({ container = true, text, scale = 1 }: ModernSpinnerProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Trigger entrance animation
        setMounted(true);
    }, []);


    const containerClass = container
        ? "flex flex-col items-center justify-center w-full min-h-[300px] py-12 transition-opacity duration-500"
        : "inline-flex flex-col items-center justify-center transition-opacity duration-500";

    return (
        <div className={`${containerClass} ${mounted ? 'opacity-100' : 'opacity-0'}`}>

            {/* Spinner Composition */}
            <div
                className="relative"
                style={{ transform: `scale(${scale})` }}
            >
                {/* Outer Ring - Soft Pulse */}
                <div className="absolute inset-0 rounded-full border-4 border-primary-100 opacity-30 animate-pulse"></div>

                {/* Middle Ring - Spinning Segment */}
                <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-primary-500 border-r-primary-500/50 animate-spin-smooth shadow-[0_0_15px_rgba(106,58,48,0.15)]"></div>

                {/* Inner Ring - Counter Spin */}
                <div className="absolute inset-2 rounded-full border-3 border-transparent border-b-secondary-400 border-l-secondary-400/50 animate-spin-reverse-slow"></div>

                {/* Core - Breathing Dot */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-primary-600 rounded-full animate-ping-slow"></div>
                </div>
            </div>

            {/* Optional Text */}
            {text && (
                <div className="mt-6 flex flex-col items-center gap-1">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse-slow">
                        {text}
                    </p>
                </div>
            )}

            {/* Global Styles for Custom Animations */}
            <style>{`
        @keyframes spin-smooth {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-reverse-slow {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes ping-slow {
            0% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.8); opacity: 0.5; }
        }
        @keyframes pulse-slow {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }

        .animate-spin-smooth {
          animation: spin-smooth 1.5s linear infinite;
        }
        .animate-spin-reverse-slow {
          animation: spin-reverse-slow 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .animate-ping-slow {
           animation: ping-slow 2s ease-in-out infinite;
        }
        .animate-pulse-slow {
           animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
}
