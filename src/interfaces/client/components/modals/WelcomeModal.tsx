import { PartyPopper, ArrowRight } from "lucide-react"

type WelcomeModalProps = {
    active: boolean
    onClose: () => void
    userName?: string
}

export default function WelcomeModal({ active, onClose, userName }: WelcomeModalProps) {
    if (!active) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#6A3A30]/60 backdrop-blur-sm animate-in fade-in duration-500"
                onClick={onClose}
            />

            {/* Card */}
            <div className="relative w-full max-w-sm bg-[#FFFBEA] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-[#6A3A30]/10">

                {/* Header Graphic */}
                <div className="relative h-40 bg-gradient-to-br from-[#1A864D] via-[#AFC8BF] to-[#6A3A30] flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.8),transparent)]" />
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                    <div className="relative z-10 p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-xl animate-bounce-slow">
                        <PartyPopper className="text-[#FFFBEA] w-10 h-10" strokeWidth={1.5} />
                    </div>

                    {/* Confetti particles (simplified CSS dots) */}
                    <div className="absolute top-10 left-10 w-2 h-2 bg-[#FFFBEA] rounded-full animate-ping" />
                    <div className="absolute bottom-10 right-10 w-2 h-2 bg-[#6A3A30] rounded-full animate-ping delay-300" />
                </div>

                {/* Content */}
                <div className="p-8 text-center">
                    <h2 className="text-sm font-bold text-[#1A864D] uppercase tracking-widest mb-3">
                        ¡Bienvenido al Club!
                    </h2>
                    <h3 className="text-3xl font-black text-[#6A3A30] mb-4 leading-tight">
                        Hola, {userName || "viajero"}
                    </h3>
                    <p className="text-[#6A3A30]/80 font-medium leading-relaxed mb-8">
                        Gracias por unirte a <span className="font-bold text-[#6A3A30]">Krums Loyalty</span>.
                        Estás a punto de disfrutar del mejor sabor con recompensas increíbles.
                        ¡Empieza a sumar puntos hoy!
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full h-14 bg-[#6A3A30] hover:bg-[#5a3128] active:scale-[0.98] text-[#FFFBEA] rounded-2xl font-bold text-lg shadow-xl shadow-[#6A3A30]/20 flex items-center justify-center gap-2 transition-all group"
                    >
                        Comenzar aventura
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    )
}
