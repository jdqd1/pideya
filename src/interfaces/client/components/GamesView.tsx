import { useState, useRef, useEffect, cloneElement } from "react"
import { ArrowRight, Clock3, Crosshair, Gamepad2, Sparkles, User } from "lucide-react"

export function GamesView() {
    const [activeGame, setActiveGame] = useState<string | null>(null)

    if (activeGame === "impostor") {
        return <ImpostorGame onBack={() => setActiveGame(null)} />
    }

    if (activeGame === "charades") {
        return <CharadesGame onBack={() => setActiveGame(null)} />
    }

    if (activeGame === "killer") {
        return <KillerGame onBack={() => setActiveGame(null)} />
    }

    if (activeGame === "truth") {
        return <TruthOrDareGame onBack={() => setActiveGame(null)} />
    }

    const gamesList = [
        {
            id: "impostor",
            title: "Impostor",
            description: "¡Encuentra al espía! Deducción y engaño.",
            icon: <User size={48} className="text-[#FFFBEA]" />,
            color: "bg-gradient-to-br from-violet-600 to-indigo-700",
            accent: "text-violet-100",
            border: "border-transparent",
            buttonBg: "bg-white/20 backdrop-blur-md hover:bg-white/30 text-white",
            image: "/images/games/impostor.jpg"
        },
        {
            id: "charades",
            title: "Charadas",
            description: "Adivina la palabra antes del tiempo.",
            icon: <Gamepad2 size={48} className="text-[#FFFBEA]" />,
            color: "bg-[#6A3A30]", // Fallback theme color
            accent: "text-[#FFFBEA]",
            border: "border-transparent",
            buttonBg: "bg-white/20 backdrop-blur-md hover:bg-white/30 text-white",
            image: "/images/games/charades.jpg"
        },
        {
            id: "killer",
            title: "El Asesino",
            description: "Un asesino suelto, un detective y muchos ciudadanos.",
            icon: <Crosshair size={48} className="text-[#FFFBEA]" />,
            color: "bg-gradient-to-br from-rose-600 to-red-700",
            accent: "text-rose-100",
            border: "border-transparent",
            buttonBg: "bg-white/20 backdrop-blur-md hover:bg-white/30 text-white",
            image: "/images/games/killer.jpg"
        },
        {
            id: "truth",
            title: "Verdad o Reto",
            description: "Descubre secretos o cumple desafíos.",
            icon: <Sparkles size={48} className="text-[#FFFBEA]" />,
            color: "bg-gradient-to-br from-pink-500 to-rose-500",
            accent: "text-rose-100",
            border: "border-transparent",
            buttonBg: "bg-white/20 backdrop-blur-md hover:bg-white/30 text-white",
            // image: "/images/games/truth.jpg" 
        }
    ]

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
            <div className="mb-8 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#6A3A30] shadow-xl shadow-[#6A3A30]/20 mb-4 ring-4 ring-[#FFFBEA] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Gamepad2 size={32} className="text-[#FFFBEA] relative z-10" />
                </div>
                <h2 className="text-3xl font-black text-[#6A3A30] tracking-tight">Arcade Zone</h2>
                <p className="text-[#6A3A30]/60 font-medium max-w-sm mx-auto leading-relaxed">
                    Gana puntos y diviértete con nuestros juegos exclusivos.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto px-2">
                {gamesList.map((game) => (
                    <div
                        key={game.id}
                        onClick={() => setActiveGame(game.id)}
                        className={`relative aspect-[16/9] overflow-hidden rounded-[2rem] shadow-lg cursor-pointer group transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl ${!game.image ? game.color : "bg-[#6A3A30]"}`}
                    >
                        {/* Background Image or Gradient Pattern */}
                        {game.image ? (
                            <img
                                src={game.image}
                                alt={game.title}
                                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
                            />
                        ) : (
                            <div className={`absolute inset-0 ${game.color} opacity-100`}>
                                {/* Decorative pattern for non-image cards */}
                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 opacity-30">
                                    {cloneElement(game.icon as any, { size: 120, strokeWidth: 1 })}
                                </div>
                            </div>
                        )}

                        {/* Dark Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#6A3A30]/90 via-[#6A3A30]/30 to-transparent opacity-90 transition-opacity duration-300" />

                        {/* Content */}
                        <div className="absolute inset-0 p-6 flex flex-col justify-end">
                            <div className="flex items-end justify-between w-full gap-4">
                                <div className="transform transition-transform duration-300 translate-y-1 group-hover:translate-y-0 text-left">
                                    <h3 className="text-2xl md:text-3xl font-black text-[#FFFBEA] leading-none tracking-tight shadow-black drop-shadow-lg">{game.title}</h3>
                                </div>

                                <button
                                    className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm backdrop-blur-md transition-all flex items-center gap-2 shadow-lg shadow-black/20 hover:scale-105 active:scale-95 ${game.buttonBg}`}
                                >
                                    Jugar
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ... (Sub-components - Updating common UI elements like buttons and containers)

function KillerGame({ onBack }: { onBack: () => void }) {
    const [step, setStep] = useState<"instructions" | "setup" | "names" | "reveal" | "play" | "result">("instructions")
    const [players, setPlayers] = useState(4)
    const [currentPlayer, setCurrentPlayer] = useState(0)
    const [showRole, setShowRole] = useState(false)
    const [roles, setRoles] = useState<string[]>([])
    const [playerNames, setPlayerNames] = useState<string[]>([])

    const startGame = () => {
        // Assign roles: 1 Assassin, 1 Detective, rest Citizens
        let newRoles = Array(players).fill("citizen")
        let assassinIndex = Math.floor(Math.random() * players)
        newRoles[assassinIndex] = "assassin"

        let detectiveIndex
        do {
            detectiveIndex = Math.floor(Math.random() * players)
        } while (detectiveIndex === assassinIndex)
        newRoles[detectiveIndex] = "detective"

        setRoles(newRoles)
        setStep("reveal")
        setCurrentPlayer(0)
    }

    const handleNameChange = (index: number, name: string) => {
        const newNames = [...playerNames]
        newNames[index] = name
        setPlayerNames(newNames)
    }

    const nextPlayer = () => {
        if (currentPlayer < players - 1) {
            setCurrentPlayer(prev => prev + 1)
            setShowRole(false)
        } else {
            setStep("play")
        }
    }

    const getRoleData = (role: string) => {
        switch (role) {
            case "assassin":
                return { title: "ASESINO", icon: "👿", color: "text-rose-600", desc: "Mata a los ciudadanos guiñando un ojo. ¡Que no te vea el detective!" }
            case "detective":
                return { title: "DETECTIVE", icon: "🕵️‍♂️", color: "text-blue-600", desc: "Identifica y acusa al asesino antes de que acabe con todos." }
            default:
                return { title: "CIUDADANO", icon: "😨", color: "text-[#6A3A30]/60", desc: "¡Sobrevive! Si ves guiñar al asesino, has muerto." }
        }
    }

    const initializeNames = () => {
        const defaultNames = Array.from({ length: players }, (_, i) => `Jugador ${i + 1}`)
        setPlayerNames(defaultNames)
        setStep("names")
    }

    const CommonContainer = ({ children, title, icon, color = "bg-rose-600" }: any) => (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
            <button onClick={onBack} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Salir</span></button>
            <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4">
                <div className={`${color} px-8 py-10 relative overflow-hidden`}>
                    <div className="relative z-10 flex flex-col items-center">
                        {icon}
                        <h2 className="text-2xl font-black text-[#FFFBEA] mt-2">{title}</h2>
                    </div>
                </div>
                <div className="p-8 space-y-6 text-left">
                    {children}
                </div>
            </div>
        </div>
    )

    if (step === "instructions") {
        return (
            <CommonContainer title="El Asesino" icon={<Crosshair size={40} className="text-[#FFFBEA]" />}>
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-[#6A3A30]">Reglas del Juego</h3>
                    <ul className="space-y-4">
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 text-xl">👿</span>
                            <span><strong>Asesino:</strong> Mata guiñando el ojo a los ciudadanos. Si te ve el detective, ¡pierdes!</span>
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 text-xl">🕵️‍♂️</span>
                            <span><strong>Detective:</strong> Atento a los guiños. Acusa al asesino para ganar.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 text-xl">😨</span>
                            <span><strong>Ciudadano:</strong> Si el asesino te guiña el ojo, mueres dramáticamente. ¡No delates al asesino!</span>
                        </li>
                    </ul>
                </div>
                <button onClick={() => setStep("setup")} className="w-full py-4 rounded-xl bg-[#6A3A30] text-[#FFFBEA] font-black text-lg shadow-xl hover:bg-[#5a3128] transition-all">
                    Jugar
                </button>
            </CommonContainer>
        )
    }

    if (step === "setup") {
        return (
            <CommonContainer title="Jugadores" icon={<Crosshair size={40} className="text-[#FFFBEA]" />}>
                <div className="flex items-center justify-center gap-6">
                    <button onClick={() => setPlayers(p => Math.max(3, p - 1))} className="w-14 h-14 rounded-2xl bg-white text-[#6A3A30] border border-[#6A3A30]/10 font-black text-2xl hover:bg-[#6A3A30]/5">-</button>
                    <span className="text-4xl font-black text-[#6A3A30]">{players}</span>
                    <button onClick={() => setPlayers(p => Math.min(20, p + 1))} className="w-14 h-14 rounded-2xl bg-white text-[#6A3A30] border border-[#6A3A30]/10 font-black text-2xl hover:bg-[#6A3A30]/5">+</button>
                </div>
                <p className="text-xs text-[#6A3A30]/40 font-medium text-center">Mínimo 3 jugadores</p>
                <button onClick={initializeNames} className="w-full py-4 rounded-xl bg-[#6A3A30] text-[#FFFBEA] font-black text-lg shadow-xl hover:bg-[#5a3128] transition-all">Siguiente</button>
            </CommonContainer>
        )
    }

    if (step === "names") {
        return (
            <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
                <button onClick={() => setStep("setup")} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Atrás</span></button>
                <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4 flex flex-col max-h-[70vh]">
                    <div className="bg-rose-600 px-8 py-6 shrink-0">
                        <h2 className="text-xl font-black text-[#FFFBEA]">Nombres</h2>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {playerNames.map((name, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="w-6 text-sm font-bold text-[#6A3A30]/40 text-right">{i + 1}.</span>
                                <input
                                    value={name}
                                    onChange={(e) => handleNameChange(i, e.target.value)}
                                    className="flex-1 bg-white border border-[#6A3A30]/10 rounded-xl px-4 py-3 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-[#6A3A30]/20 transition-all"
                                    placeholder={`Jugador ${i + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="p-6 pt-2 shrink-0">
                        <button onClick={startGame} className="w-full py-4 rounded-xl bg-[#6A3A30] text-[#FFFBEA] font-black text-lg shadow-xl hover:bg-[#5a3128] transition-all">
                            ¡Repartir Roles!
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === "reveal") {
        const role = roles[currentPlayer]
        const rData = getRoleData(role)
        const playerName = playerNames[currentPlayer]
        const nextName = currentPlayer < players - 1 ? playerNames[currentPlayer + 1] : ""

        return (
            <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
                <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4 h-[450px] flex flex-col">
                    <div className="bg-[#6A3A30] px-8 py-6">
                        <h2 className="text-xl font-black text-[#FFFBEA]">{playerName}</h2>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                        {!showRole ? (
                            <>
                                <p className="text-[#6A3A30]/60 font-medium">Pasa el teléfono a <strong>{playerName}</strong> y presiona ver.</p>
                                <button onClick={() => setShowRole(true)} className="px-8 py-4 rounded-xl bg-[#6A3A30] text-[#FFFBEA] font-bold shadow-lg">Ver mi Rol</button>
                            </>
                        ) : (
                            <div className="animate-in zoom-in duration-300 space-y-4">
                                <div className="text-6xl">{rData.icon}</div>
                                <div>
                                    <h3 className={`text-3xl font-black ${rData.color} mb-2 uppercase`}>{rData.title}</h3>
                                    <p className="text-sm font-medium text-[#6A3A30]/60">{rData.desc}</p>
                                </div>
                                <button onClick={nextPlayer} className="w-full py-4 rounded-xl bg-white border border-[#6A3A30]/10 text-[#6A3A30] font-bold hover:bg-[#6A3A30]/5 mt-4">
                                    {currentPlayer < players - 1 ? `Siguiente: ${nextName}` : "Empezar Juego"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    if (step === "play") {
        return (
            <CommonContainer title="¡Juego en Curso!" icon={<Crosshair size={40} className="text-[#FFFBEA]" />}>
                <div className="bg-white p-6 rounded-2xl text-left space-y-3 border border-[#6A3A30]/10">
                    <p className="text-sm text-[#6A3A30]/80"><strong>Asesino:</strong> Guiña el ojo con disimulo.</p>
                    <p className="text-sm text-[#6A3A30]/80"><strong>Ciudadanos:</strong> Si te guiñan, espera 5 segundos y anuncia tu muerte.</p>
                    <p className="text-sm text-[#6A3A30]/80"><strong>Detective:</strong> ¡Acusa si estás seguro!</p>
                </div>
                <div className="pt-4">
                    <button onClick={() => setStep("result")} className="w-full py-4 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 shadow-lg mb-3">Revelar Roles</button>
                    <button onClick={() => setStep("setup")} className="w-full py-4 rounded-xl bg-white border border-[#6A3A30]/10 text-[#6A3A30] font-bold hover:bg-[#6A3A30]/5">Nueva Partida</button>
                </div>
            </CommonContainer>
        )
    }

    if (step === "result") {
        return (
            <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
                <button onClick={onBack} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Salir</span></button>
                <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4 flex flex-col max-h-[70vh]">
                    <div className="bg-[#6A3A30] px-8 py-6 shrink-0">
                        <h2 className="text-xl font-black text-[#FFFBEA]">Roles Revelados</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 p-6 custom-scrollbar">
                        {roles.map((role, i) => {
                            const rData = getRoleData(role)
                            return (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white border border-[#6A3A30]/10">
                                    <div className="w-10 h-10 rounded-full bg-[#FFFBEA] flex items-center justify-center text-xl shadow-sm shrink-0">
                                        {rData.icon}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-[#6A3A30]/40 uppercase">{playerNames[i]}</p>
                                        <p className={`font-black ${rData.color}`}>{rData.title}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="p-6 pt-2 shrink-0">
                        <button onClick={startGame} className="w-full py-4 rounded-xl bg-[#6A3A30] text-[#FFFBEA] font-black hover:bg-[#5a3128] shadow-lg">Jugar Otra Vez</button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}

function ImpostorGame({ onBack }: { onBack: () => void }) {
    const [step, setStep] = useState<"instructions" | "setup" | "names" | "reveal" | "play" | "result">("instructions")
    const [players, setPlayers] = useState(4)
    const [currentPlayer, setCurrentPlayer] = useState(0)
    const [showRole, setShowRole] = useState(false)
    const [impostorIndex, setImpostorIndex] = useState(-1)
    const [secretWord, setSecretWord] = useState("")
    const [playerNames, setPlayerNames] = useState<string[]>([])

    // ... (Game Logic same as before)
    const words = [
        "Playa", "Cine", "Hospital", "Escuela", "Avión", "Supermercado",
        "Gimnasio", "Biblioteca", "Restaurante", "Zoológico"
    ]

    const startGame = () => {
        const imp = Math.floor(Math.random() * players)
        const word = words[Math.floor(Math.random() * words.length)]
        setImpostorIndex(imp)
        setSecretWord(word)
        setStep("reveal")
        setCurrentPlayer(0)
    }

    const handleNameChange = (index: number, name: string) => {
        const newNames = [...playerNames]
        newNames[index] = name
        setPlayerNames(newNames)
    }

    const initializeNames = () => {
        const defaultNames = Array.from({ length: players }, (_, i) => `Jugador ${i + 1}`)
        setPlayerNames(defaultNames)
        setStep("names")
    }

    const nextPlayer = () => {
        if (currentPlayer < players - 1) {
            setCurrentPlayer(prev => prev + 1)
            setShowRole(false)
        } else {
            setStep("play")
        }
    }


    const CommonContainer = ({ children, title, icon, color = "bg-violet-600" }: any) => (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
            <button onClick={onBack} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Salir</span></button>
            <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4">
                <div className={`${color} px-8 py-10 relative overflow-hidden`}>
                    <div className="relative z-10 flex flex-col items-center">
                        {icon}
                        <h2 className="text-2xl font-black text-[#FFFBEA] mt-2">{title}</h2>
                    </div>
                </div>
                <div className="p-8 space-y-6 text-left">
                    {children}
                </div>
            </div>
        </div>
    )

    if (step === "instructions") {
        return (
            <CommonContainer title="Impostor" icon={<User size={40} className="text-[#FFFBEA]" />}>
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-[#6A3A30]">¿Cómo jugar?</h3>
                    <ul className="space-y-3">
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs">1</span>
                            Todos recibirán una palabra secreta, excepto el Impostor.
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs">2</span>
                            Por turnos, describan su palabra sin ser demasiado obvios.
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs">3</span>
                            ¡Debatan y voten para descubrir quién es el Impostor!
                        </li>
                    </ul>
                </div>
                <button onClick={() => setStep("setup")} className="w-full py-4 rounded-xl bg-violet-600 text-white font-black text-lg shadow-xl hover:bg-violet-700 transition-all">
                    Jugar
                </button>
            </CommonContainer>
        )
    }

    if (step === "setup") {
        return (
            <CommonContainer title="Configuración" icon={<User size={40} className="text-[#FFFBEA]" />}>
                <div className="flex items-center justify-center gap-6">
                    <button onClick={() => setPlayers(p => Math.max(3, p - 1))} className="w-14 h-14 rounded-2xl bg-white text-[#6A3A30] border border-[#6A3A30]/10 font-black text-2xl hover:bg-[#6A3A30]/5">-</button>
                    <span className="text-4xl font-black text-[#6A3A30]">{players}</span>
                    <button onClick={() => setPlayers(p => Math.min(12, p + 1))} className="w-14 h-14 rounded-2xl bg-white text-[#6A3A30] border border-[#6A3A30]/10 font-black text-2xl hover:bg-[#6A3A30]/5">+</button>
                </div>
                <button onClick={initializeNames} className="w-full py-4 rounded-xl bg-violet-600 text-white font-black text-lg shadow-xl hover:bg-violet-700 transition-all">Siguiente</button>
            </CommonContainer>
        )
    }

    if (step === "names") {
        return (
            <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
                <button onClick={() => setStep("setup")} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Atrás</span></button>
                <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4 flex flex-col max-h-[70vh]">
                    <div className="bg-violet-600 px-8 py-6 shrink-0">
                        <h2 className="text-xl font-black text-[#FFFBEA]">Nombres</h2>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {playerNames.map((name, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="w-6 text-sm font-bold text-[#6A3A30]/40 text-right">{i + 1}.</span>
                                <input
                                    value={name}
                                    onChange={(e) => handleNameChange(i, e.target.value)}
                                    className="flex-1 bg-white border border-[#6A3A30]/10 rounded-xl px-4 py-3 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-violet-200 transition-all"
                                    placeholder={`Jugador ${i + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="p-6 pt-2 shrink-0">
                        <button onClick={startGame} className="w-full py-4 rounded-xl bg-violet-600 text-white font-black text-lg shadow-xl hover:bg-violet-700 transition-all">
                            ¡Empezar!
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === "reveal") {
        const currentPlayerName = playerNames[currentPlayer]
        const nextPlayerName = currentPlayer < players - 1 ? playerNames[currentPlayer + 1] : ""
        return (
            <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
                <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4 h-[400px] flex flex-col">
                    <div className="bg-[#6A3A30] px-8 py-6">
                        <h2 className="text-xl font-black text-[#FFFBEA]">{currentPlayerName}</h2>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                        {!showRole ? (
                            <>
                                <p className="text-[#6A3A30]/60 font-medium">Pasa el teléfono a <strong>{currentPlayerName}</strong> y presiona ver.</p>
                                <button onClick={() => setShowRole(true)} className="px-8 py-4 rounded-xl bg-[#6A3A30] text-[#FFFBEA] font-bold shadow-lg">Ver mi Rol</button>
                            </>
                        ) : (
                            <div className="animate-in zoom-in duration-300 space-y-4">
                                <p className="text-sm font-bold text-[#6A3A30]/40 uppercase tracking-widest">Tu eres...</p>
                                {currentPlayer === impostorIndex ? (
                                    <h3 className="text-3xl font-black text-rose-500">¡EL IMPOSTOR!</h3>
                                ) : (
                                    <div>
                                        <h3 className="text-3xl font-black text-emerald-500 mb-2">CIUDADANO</h3>
                                        <div className="bg-white border border-[#6A3A30]/10 px-4 py-2 rounded-lg inline-block">
                                            <p className="text-xl font-bold text-[#6A3A30]">{secretWord}</p>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-[#6A3A30]/40 max-w-[200px] mx-auto pt-4">Memoriza esto y presiona siguiente para ocultarlo.</p>
                                <button onClick={nextPlayer} className="w-full py-4 rounded-xl bg-white border border-[#6A3A30]/10 text-[#6A3A30] font-bold hover:bg-[#6A3A30]/5">
                                    {currentPlayer < players - 1 ? `Siguiente: ${nextPlayerName}` : "Empezar Juego"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    if (step === "play") {
        return (
            <CommonContainer title="¡A Debatir!" icon={<Clock3 size={40} className="text-[#FFFBEA]" />}>
                <div className="text-center space-y-2">
                    <p className="text-[#6A3A30]/80">Hagan preguntas, descubran quién miente y voten para expulsar al impostor.</p>
                </div>
                <div className="pt-4">
                    <button onClick={() => setStep("result")} className="w-full py-4 rounded-xl bg-rose-500 text-white font-black hover:bg-rose-600 shadow-lg mb-3">Revelar Impostor</button>
                    <button onClick={() => setStep("setup")} className="w-full py-4 rounded-xl bg-white border border-[#6A3A30]/10 text-[#6A3A30] font-bold hover:bg-[#6A3A30]/5">Nueva Partida</button>
                </div>
            </CommonContainer>
        )
    }

    if (step === "result") {
        return (
            <CommonContainer title="Resultado" icon={<User size={40} className="text-[#FFFBEA]" />}>
                <div className="text-center py-4">
                    <h2 className="text-xl font-black text-[#6A3A30] mb-4">El Impostor era...</h2>
                    <div className="py-2">
                        <p className="text-3xl font-black text-rose-600 mt-2">{playerNames[impostorIndex]}</p>
                    </div>
                    <div className="bg-white border border-[#6A3A30]/10 p-4 rounded-2xl mt-6">
                        <p className="text-[#6A3A30]/40 text-sm">Palabra Secreta:</p>
                        <p className="text-xl font-black text-[#6A3A30] uppercase">{secretWord}</p>
                    </div>
                </div>
                <button onClick={() => setStep("setup")} className="w-full py-4 rounded-xl bg-violet-600 text-white font-black hover:bg-violet-700 shadow-lg mt-4">Jugar Otra Vez</button>
            </CommonContainer>
        )
    }

    return null
}

function CharadesGame({ onBack }: { onBack: () => void }) {
    const [step, setStep] = useState<"instructions" | "category_select" | "play">("instructions")
    const [active, setActive] = useState(false)
    const [word, setWord] = useState("...")
    const [selectedCategory, setSelectedCategory] = useState<string>("")
    const [timeLeft, setTimeLeft] = useState(60)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const categories = [
        { id: "movies", name: "Películas", icon: "🎬", color: "bg-indigo-500", words: ["Spiderman", "Titanic", "Avatar", "Harry Potter", "Frozen", "Matrix", "Coco", "Shrek", "Joker", "Barbie"] },
        { id: "animals", name: "Animales", icon: "🦁", color: "bg-emerald-500", words: ["León", "Elefante", "Jirafa", "Mono", "Pingüino", "Canguro", "Delfín", "Tigre", "Oso", "Águila"] },
        { id: "actions", name: "Acciones", icon: "🏃", color: "bg-rose-500", words: ["Bailar", "Cantar", "Dormir", "Comer", "Nadar", "Correr", "Llorar", "Reír", "Cocinar", "Pintar"] },
        { id: "objects", name: "Objetos", icon: "📦", color: "bg-amber-500", words: ["Silla", "Mesa", "Teléfono", "Lápiz", "Cuchara", "Zapato", "Reloj", "Libro", "Llave", "Vaso"] },
        { id: "characters", name: "Personajes", icon: "🦸", color: "bg-cyan-500", words: ["Batman", "Mickey Mouse", "Super Mario", "Pikachu", "SpongeBob", "Goku", "El Chavo", "Shakira"] },
        { id: "places", name: "Lugares", icon: "🌍", color: "bg-violet-500", words: ["Playa", "Escuela", "Hospital", "Cine", "Parque", "Aeropuerto", "Estadio", "Museo", "Iglesia"] },
    ]

    useEffect(() => {
        if (active && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((t) => t - 1)
            }, 1000)
        } else if (timeLeft === 0) {
            setActive(false)
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [active, timeLeft])

    const startGame = (categoryId: string) => {
        setSelectedCategory(categoryId)
        setStep("play")
        setActive(false)
        setWord("...")
        setTimeLeft(60)
    }

    const nextWord = () => {
        if (!active) {
            setActive(true)
            setTimeLeft(60)
        }
        const category = categories.find(c => c.id === selectedCategory)
        if (category) {
            const random = category.words[Math.floor(Math.random() * category.words.length)]
            setWord(random)
        }
    }

    const CommonContainer = ({ children, title, icon, color = "bg-emerald-500" }: any) => (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
            <button onClick={onBack} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Salir</span></button>
            <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4">
                <div className={`${color} px-8 py-10 relative overflow-hidden`}>
                    <div className="relative z-10 flex flex-col items-center">
                        {icon}
                        <h2 className="text-2xl font-black text-[#FFFBEA] mt-2">{title}</h2>
                    </div>
                </div>
                <div className="p-8 space-y-6 text-left">
                    {children}
                </div>
            </div>
        </div>
    )

    if (step === "instructions") {
        return (
            <CommonContainer title="Charades" icon={<Gamepad2 size={40} className="text-[#FFFBEA]" />}>
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-[#6A3A30]">¿Cómo jugar?</h3>
                    <ul className="space-y-3">
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">1</span>
                            Elige una categoría de palabras.
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">2</span>
                            Coloca el teléfono en tu frente sin ver la pantalla.
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">3</span>
                            Tus amigos actuarán para que adivines la palabra antes del tiempo.
                        </li>
                    </ul>
                </div>
                <button onClick={() => setStep("category_select")} className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-lg shadow-xl hover:bg-emerald-700 transition-all">
                    Jugar
                </button>
            </CommonContainer>
        )
    }

    if (step === "category_select") {
        return (
            <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
                <button onClick={() => setStep("instructions")} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Atrás</span></button>
                <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 pb-8 mt-4">
                    <div className="p-6 border-b border-[#6A3A30]/5">
                        <h2 className="text-xl font-black text-[#6A3A30] text-center">Elige Categoría</h2>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => startGame(cat.id)}
                                className={`p-4 rounded-2xl ${cat.color} text-white hover:scale-[1.02] transition-transform shadow-md flex flex-col items-center justify-center gap-2 h-32`}
                            >
                                <span className="text-3xl">{cat.icon}</span>
                                <span className="font-bold text-sm">{cat.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Play View
    const category = categories.find(c => c.id === selectedCategory)

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
            <button onClick={() => setStep("category_select")} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 transition-all z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Salir</span></button>
            <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4">
                <div className={`${category?.color || "bg-[#6A3A30]"} px-8 py-10 relative overflow-hidden transition-colors duration-500`}>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="flex items-center gap-2 text-white/80 text-sm font-bold uppercase tracking-wider mb-2">
                            <span>{category?.icon}</span>
                            <span>{category?.name}</span>
                        </div>
                        <h2 className="text-4xl font-black text-[#FFFBEA] animate-in zoom-in duration-300">
                            {timeLeft}s
                        </h2>
                    </div>
                </div>
                <div className="p-8 space-y-8 min-h-[300px] flex flex-col justify-center">
                    {active ? (
                        <div className="animate-in zoom-in duration-300">
                            <p className="text-sm font-bold text-[#6A3A30]/40 uppercase tracking-widest mb-4">Tu palabra es</p>
                            <p className="text-5xl font-black text-[#6A3A30] leading-tight">{word}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {timeLeft === 0 ? (
                                <>
                                    <div className="text-6xl">⏰</div>
                                    <p className="text-xl font-bold text-[#6A3A30]">¡Tiempo Agotado!</p>
                                </>
                            ) : (
                                <p className="text-[#6A3A30]/60 font-medium text-lg px-8">Coloca el teléfono en tu frente.</p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={nextWord}
                        className={`w-full py-5 rounded-2xl text-[#FFFBEA] font-black text-lg shadow-xl transition-all ${active ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#6A3A30] hover:bg-[#5a3128]"}`}
                    >
                        {active ? "Pasar / Siguiente" : (timeLeft === 0 ? "Jugar de Nuevo" : "Empezar")}
                    </button>
                </div>
            </div>
        </div>
    )
}

function TruthOrDareGame({ onBack }: { onBack: () => void }) {
    const [step, setStep] = useState<"instructions" | "play">("instructions")

    const CommonContainer = ({ children, title, icon, color = "bg-rose-500" }: any) => (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
            <button onClick={onBack} className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 z-20 shadow-sm"><ArrowRight size={18} className="rotate-180" /><span className="text-sm">Salir</span></button>
            <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4">
                <div className={`${color} px-8 py-10 relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 mix-blend-overlay" />
                    <div className="relative z-10 flex flex-col items-center">
                        {icon}
                        <h2 className="text-2xl font-black text-[#FFFBEA] mt-2">{title}</h2>
                    </div>
                </div>
                <div className="p-8 space-y-6 text-left">
                    {children}
                </div>
            </div>
        </div>
    )

    if (step === "instructions") {
        return (
            <CommonContainer title="Verdad o Reto" icon={<Sparkles size={40} className="text-[#FFFBEA]" />}>
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-[#6A3A30]">¿Cómo jugar?</h3>
                    <ul className="space-y-3">
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">1</span>
                            Reúnete con tus amigos en círculo.
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">2</span>
                            Decide si quieres responder una verdad incómoda o cumplir un reto atrevido.
                        </li>
                        <li className="flex gap-3 text-sm text-[#6A3A30]/80 font-medium leading-relaxed">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">3</span>
                            ¡Si te niegas, debes cumplir un castigo del grupo!
                        </li>
                    </ul>
                </div>
                <button onClick={() => setStep("play")} className="w-full py-4 rounded-xl bg-rose-600 text-white font-black text-lg shadow-xl hover:bg-rose-700 transition-all">
                    Jugar
                </button>
            </CommonContainer>
        )
    }

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto relative px-4 pt-10">
            <button
                onClick={() => setStep("instructions")}
                className="absolute top-0 left-0 p-3 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-white font-bold flex items-center gap-2 transition-all z-20 shadow-sm"
            >
                <ArrowRight size={18} className="rotate-180" />
                <span className="text-sm">Atrás</span>
            </button>

            <div className="bg-[#FFFBEA] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#6A3A30]/10 text-center pb-8 mt-4">
                <div className="bg-rose-500 px-8 py-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10 mix-blend-overlay" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 border-4 border-white/20 shadow-xl">
                            <Sparkles size={48} className="text-[#FFFBEA]" />
                        </div>
                        <h2 className="text-3xl font-black text-[#FFFBEA] tracking-tight">Verdad o Reto</h2>
                        <p className="text-rose-100 font-medium">¿Te atreves?</p>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100">
                        <p className="text-rose-900 font-medium text-lg italic">
                            "Toca el botón para girar la botella y comenzar el juego."
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button className="py-8 rounded-2xl bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 flex flex-col items-center gap-2 transition-all group">
                            <span className="text-3xl">😇</span>
                            <span className="font-black text-indigo-900 group-hover:text-indigo-600">Verdad</span>
                        </button>
                        <button className="py-8 rounded-2xl bg-white border-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50 flex flex-col items-center gap-2 transition-all group">
                            <span className="text-3xl">😈</span>
                            <span className="font-black text-rose-900 group-hover:text-rose-600">Reto</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
