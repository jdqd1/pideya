import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#FFFBEA] transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

      {/* Background Subtle Texture/Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#afc8bf]/20 to-[#6A3A30]/5 blur-3xl opacity-60 animate-pulse-slow" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-bl from-[#afc8bf]/10 to-[#FFFBEA]/50 blur-3xl opacity-60 animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative flex flex-col items-center">
        {/* Main Composition */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32">

          {/* Ring 1 - Organic base */}
          <svg className="absolute inset-0 w-full h-full animate-spin-slow text-[#6A3A30]/10" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="180 100" strokeLinecap="round" />
          </svg>

          {/* Ring 2 - Dynamic Accent */}
          <svg className="absolute inset-0 w-full h-full animate-spin-reverse text-[#6A3A30]" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" stroke="url(#gradient)" strokeWidth="2.5" fill="none" strokeDasharray="100 200" strokeLinecap="round" className="opacity-90" />
          </svg>

          {/* Inner pulsating core */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-[#FFFBEA] rounded-full shadow-[0_8px_30px_rgb(106,58,48,0.1)] flex items-center justify-center animate-breath">
              <div className="w-2.5 h-2.5 bg-[#6A3A30] rounded-full animate-ping-slow opacity-20 absolute" />
              <div className="w-2 h-2 bg-[#6A3A30] rounded-full" />
            </div>
          </div>

          {/* Orbital Particles */}
          <div className="absolute inset-0 animate-spin-medium">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-1.5 h-1.5 bg-[#afc8bf] rounded-full shadow-sm" />
          </div>

        </div>

        {/* Branding - Minimalist */}
        <div className="mt-8 flex flex-col items-center animate-pulse-slow font-bold tracking-[0.2em] text-[#6A3A30]/60 text-sm">
          <span className="lowercase">krums</span>
        </div>

      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes spin-medium {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes breath {
           0%, 100% { transform: scale(0.95); box-shadow: 0 0 0 rgba(0,0,0,0); }
           50% { transform: scale(1.05); box-shadow: 0 10px 40px -10px rgba(106, 58, 48, 0.25); }
        }
        @keyframes ping-slow {
           75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes pulse-slow {
           0%, 100% { opacity: 0.6; transform: scale(1); }
           50% { opacity: 0.4; transform: scale(1.1); }
        }

        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .animate-spin-medium {
           animation: spin-medium 5s linear infinite;
        }
        .animate-breath {
           animation: breath 3s ease-in-out infinite;
        }
        .animate-ping-slow {
           animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-pulse-slow {
           animation: pulse-slow 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

