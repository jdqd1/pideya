import { useState, useMemo } from "react"
import type { ChangeEvent } from "react"
import { AlertCircle, Home, Loader, Lock, Map, Plus, Star, Trash2, User } from "lucide-react"
import type { DeliveryLocation } from "../../../types/app"
import type { AuthUser } from "../../../types/userState"

type ProfileViewProps = {
    user: AuthUser | null
    phone: string
    cedula: string
    name: string
    onSavePhone: (phone: string) => Promise<void>
    onSaveCedula: (cedula: string) => Promise<void>
    onSaveName: (name: string) => Promise<void>
    savedLocations: DeliveryLocation[]
    onDeleteLocation: (index: number) => void
    onSetDefaultLocation: (index: number) => void
    onAddLocation: () => void
}

export function ProfileView({
    user,
    phone,
    cedula,
    name,
    onSavePhone,
    onSaveCedula,
    onSaveName,
    savedLocations,
    onDeleteLocation,
    onSetDefaultLocation,
    onAddLocation,
}: ProfileViewProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [tempPhone, setTempPhone] = useState(phone)
    const [isSaving, setIsSaving] = useState(false)

    const formatPhone = (val: string) => {
        // Remove all non-digits
        const raw = val.replace(/\D/g, "").slice(0, 11)
        let formatted = raw
        if (raw.length > 4) {
            formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`
        }
        if (raw.length > 7) {
            formatted = `${formatted.slice(0, 8)}-${raw.slice(7)}`
        }
        return formatted
    }

    const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        // Allow deletion even if formatted
        setTempPhone(formatPhone(val))
    }

    // --- Cedula Logic ---
    const [isEditingCedula, setIsEditingCedula] = useState(false)
    const [tempCedula, setTempCedula] = useState(cedula)
    const [isSavingCedula, setIsSavingCedula] = useState(false)
    const [cedulaError, setCedulaError] = useState("")

    const handleCedulaChange = (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 9) // Max 9 digits for normal V/E cedula
        setTempCedula(val)
        if (cedulaError) setCedulaError("")
    }

    const isValidCedula = useMemo(() => {
        const raw = tempCedula.trim()
        return raw.length >= 6 && raw.length <= 9
    }, [tempCedula])

    const handleSaveCedula = async () => {
        if (!isValidCedula) return
        setIsSavingCedula(true)
        setCedulaError("")
        try {
            await onSaveCedula(tempCedula)
            setIsSavingCedula(false)
            setIsEditingCedula(false)
        } catch (e: any) {
            setIsSavingCedula(false)
            const message = e.message || ""
            if (message.toLowerCase().includes('registrada')) {
                setCedulaError('Esta cédula ya está registrada')
            } else {
                setCedulaError('Error al guardar')
                console.error(e)
            }
        }
    }

    // Validate full length (11 digits + 2 hyphens = 13 chars) AND correct prefixes
    const isValidPhone = useMemo(() => {
        const raw = tempPhone.replace(/\D/g, "")
        if (raw.length !== 11) return false
        const prefix = raw.slice(0, 4)
        return ["0414", "0424", "0412", "0422", "0416", "0426"].includes(prefix)
    }, [tempPhone])

    const handleSave = async () => {
        if (!isValidPhone) return
        setIsSaving(true)
        await onSavePhone(tempPhone)
        setIsSaving(false)
        setIsEditing(false)
    }

    // --- Name Logic ---
    const [isEditingName, setIsEditingName] = useState(false)
    const [tempName, setTempName] = useState(name || "")
    const [isSavingName, setIsSavingName] = useState(false)

    const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        setTempName(e.target.value)
    }

    const isValidName = useMemo(() => {
        return tempName.trim().length > 2
    }, [tempName])

    const handleSaveName = async () => {
        if (!isValidName) return
        setIsSavingName(true)
        await onSaveName(tempName)
        setIsSavingName(false)
        setIsEditingName(false)
    }

    return (
        <div className="flex flex-col items-center py-10 animate-in fade-in zoom-in-95 duration-500 px-4 pb-32">
            {/* Avatar */}
            <div className="relative mb-6 group">
                <div className="w-28 h-28 bg-gradient-to-br from-[#FFFBEA] to-[#AFC8BF] rounded-full flex items-center justify-center text-[#6A3A30] shadow-xl shadow-[#6A3A30]/10 border-4 border-white ring-1 ring-[#6A3A30]/10">
                    <span className="text-4xl font-black select-none">
                        {(name?.[0] || "C").toUpperCase()}
                    </span>
                </div>
                <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#6A3A30] rounded-full flex items-center justify-center text-[#FFFBEA] border-4 border-[#afc8bf] shadow-md">
                    <User size={14} />
                </div>
            </div>

            <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-[#6A3A30]">
                    {name || "Cliente"}
                </h2>
                <p className="text-sm font-medium text-[#6A3A30]/60">{(user as any)?.email}</p>
            </div>

            <div className="w-full max-w-md space-y-6">
                {/* Personal Info Card */}
                <div className="bg-[#FFFBEA] rounded-[2rem] p-6 shadow-sm border border-[#6A3A30]/10 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-6 border-b border-[#6A3A30]/5 pb-4">
                        <div className="w-10 h-10 rounded-2xl bg-[#6A3A30]/5 text-[#6A3A30] flex items-center justify-center border border-[#6A3A30]/10 shadow-sm">
                            <User size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-[#6A3A30] uppercase tracking-wide">Datos Personales</h3>
                            <p className="text-[10px] font-medium text-[#6A3A30]/50">Gestiona tu información básica</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* Name Field (Editable) */}
                        <div className="bg-[#6A3A30]/5 rounded-2xl p-4 border border-[#6A3A30]/5 relative transition-all focus-within:ring-2 focus-within:ring-[#6A3A30]/10 focus-within:bg-white focus-within:border-[#6A3A30]/20">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-bold text-[#6A3A30]/40 uppercase tracking-wider">Nombre completo</p>
                                {!isEditingName ? (
                                    <button onClick={() => setIsEditingName(true)} className="text-[10px] font-bold text-[#6A3A30] hover:text-[#5a3128]">EDITAR</button>
                                ) : (
                                    <button onClick={handleSaveName} disabled={isSavingName || !isValidName} className="text-[10px] font-bold text-[#1A864D] hover:text-[#146c3d] disabled:opacity-50 flex items-center gap-1">
                                        {isSavingName ? <Loader size={12} className="animate-spin" /> : "GUARDAR"}
                                    </button>
                                )}
                            </div>
                            {isEditingName ? (
                                <input
                                    value={tempName}
                                    disabled={isSavingName}
                                    onChange={handleNameChange}
                                    className={`w-full bg-transparent font-bold outline-none placeholder:text-[#6A3A30]/30 ${!isValidName && tempName ? "text-rose-500" : "text-[#6A3A30]"}`}
                                    placeholder="Tu nombre"
                                    autoFocus
                                />
                            ) : (
                                <p className="text-sm font-bold text-[#6A3A30]">{name || "Cliente"}</p>
                            )}
                        </div>

                        {/* Cedula Field (Editable) */}
                        <div className={`rounded-2xl p-4 border border-[#6A3A30]/5 relative transition-all ${isEditingCedula ? "bg-white ring-2 ring-[#6A3A30]/10 border-[#6A3A30]/20" : "bg-[#6A3A30]/5"}`}>
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-bold text-[#6A3A30]/40 uppercase tracking-wider">Cédula de Identidad</p>
                                {!isEditingCedula ? (
                                    <button onClick={() => setIsEditingCedula(true)} className="text-[10px] font-bold text-[#6A3A30] hover:text-[#5a3128]">EDITAR</button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setIsEditingCedula(false); setTempCedula(cedula); setCedulaError("") }} className="text-[10px] font-bold text-[#6A3A30]/40 hover:text-[#6A3A30]/60">CANCELAR</button>
                                        <button onClick={handleSaveCedula} disabled={isSavingCedula || !isValidCedula} className="text-[10px] font-bold text-[#1A864D] hover:text-[#146c3d] disabled:opacity-50 flex items-center gap-1">
                                            {isSavingCedula ? <Loader size={12} className="animate-spin" /> : "GUARDAR"}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {isEditingCedula ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-[#6A3A30]/40 font-bold">V-</span>
                                    <input
                                        value={tempCedula}
                                        disabled={isSavingCedula}
                                        onChange={handleCedulaChange}
                                        className={`w-full bg-transparent font-bold outline-none placeholder:text-[#6A3A30]/30 ${!isValidCedula && tempCedula ? "text-rose-500" : "text-[#6A3A30]"}`}
                                        placeholder="12345678"
                                        autoFocus
                                        maxLength={9}
                                    />
                                </div>
                            ) : (
                                <p className={`text-sm font-bold ${cedula ? "text-[#6A3A30]" : "text-[#6A3A30]/40 italic"}`}>
                                    {cedula ? `V-${cedula}` : "Sin cédula registrada"}
                                </p>
                            )}
                        </div>
                        {cedulaError && (
                            <div className="flex items-center gap-2 px-2 animate-in slide-in-from-top-1">
                                <AlertCircle size={14} className="text-rose-500" />
                                <p className="text-xs font-bold text-rose-500">{cedulaError}</p>
                            </div>
                        )}

                        {/* Email Field (Read Only) */}
                        <div className="bg-[#6A3A30]/5 rounded-2xl p-4 border border-[#6A3A30]/5 relative opacity-70">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-bold text-[#6A3A30]/40 uppercase tracking-wider">Correo Electrónico</p>
                                <Lock size={12} className="text-[#6A3A30]/30" />
                            </div>
                            <p className="text-sm font-bold text-[#6A3A30] truncate">{(user as any)?.email}</p>
                        </div>

                        {/* Phone Field (Editable) */}
                        <div className="bg-[#6A3A30]/5 rounded-2xl p-4 border border-[#6A3A30]/5 relative transition-all focus-within:ring-2 focus-within:ring-[#6A3A30]/10 focus-within:bg-white focus-within:border-[#6A3A30]/20">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-bold text-[#6A3A30]/40 uppercase tracking-wider">Teléfono</p>
                                {!isEditing ? (
                                    <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-[#6A3A30] hover:text-[#5a3128]">EDITAR</button>
                                ) : (
                                    <button onClick={handleSave} disabled={isSaving || !isValidPhone} className="text-[10px] font-bold text-[#1A864D] hover:text-[#146c3d] disabled:opacity-50 flex items-center gap-1">
                                        {isSaving ? <Loader size={12} className="animate-spin" /> : "GUARDAR"}
                                    </button>
                                )}
                            </div>
                            {isEditing ? (
                                <input
                                    value={tempPhone}
                                    disabled={isSaving}
                                    onChange={handlePhoneChange}
                                    className={`w-full bg-transparent font-bold outline-none placeholder:text-[#6A3A30]/30 ${!isValidPhone && tempPhone ? "text-rose-500" : "text-[#6A3A30]"}`}
                                    placeholder="04XX-XXX-XXXX"
                                    autoFocus
                                    maxLength={13}
                                />
                            ) : (
                                <p className={`text-sm font-bold ${phone ? "text-[#6A3A30]" : "text-[#6A3A30]/40 italic"}`}>
                                    {phone || "Sin teléfono registrado"}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Locations Card */}
                <div className="bg-[#FFFBEA] rounded-[2rem] p-6 shadow-sm border border-[#6A3A30]/10 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#1A864D]/10 text-[#1A864D] flex items-center justify-center">
                                <Map size={16} />
                            </div>
                            <h3 className="text-sm font-black text-[#6A3A30] uppercase tracking-wide">Mis Ubicaciones</h3>
                        </div>
                        <button
                            onClick={onAddLocation}
                            className="p-2 rounded-full bg-[#6A3A30]/5 text-[#6A3A30]/60 hover:bg-[#6A3A30] hover:text-[#FFFBEA] transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {savedLocations.length === 0 ? (
                            <div className="text-center py-6 border border-dashed border-[#6A3A30]/20 rounded-2xl bg-[#6A3A30]/5">
                                <Map size={24} className="mx-auto text-[#6A3A30]/30 mb-2" />
                                <p className="text-xs font-bold text-[#6A3A30]/40">No tienes ubicaciones guardadas</p>
                            </div>
                        ) : (
                            savedLocations.map((loc, idx) => (
                                <div key={idx} className="group flex items-center gap-3 p-3 rounded-2xl border border-[#6A3A30]/10 hover:border-[#6A3A30]/30 hover:shadow-sm transition-all bg-[#6A3A30]/5 relative overflow-hidden">
                                    {idx === 0 && (
                                        <div className="absolute top-0 right-0 bg-[#1A864D] text-[#FFFBEA] text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                                            DEFAULT
                                        </div>
                                    )}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${idx === 0 ? "bg-[#1A864D]/10 text-[#1A864D]" : "bg-[#6A3A30]/10 text-[#6A3A30]/40"
                                        }`}>
                                        <Home size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0 pointer-events-none">
                                        <p className="text-xs font-bold text-[#6A3A30] truncate">{loc.name}</p>
                                        <p className="text-[10px] text-[#6A3A30]/60 truncate">{loc.villa || loc.reference}</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        {idx !== 0 && (
                                            <button
                                                onClick={() => onSetDefaultLocation(idx)}
                                                className="p-1.5 text-[#6A3A30]/40 hover:text-[#6A3A30] hover:bg-[#FFFBEA] rounded-lg"
                                                title="Marcar como predeterminada"
                                            >
                                                <Star size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onDeleteLocation(idx)}
                                            className="p-1.5 text-[#6A3A30]/40 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
