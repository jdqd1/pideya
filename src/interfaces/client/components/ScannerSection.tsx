import { type Dispatch, type SetStateAction, type RefObject } from "react"
import { AlertCircle, ArrowRight, CheckCircle2, ScanLine, X } from "lucide-react"
import type { ScannerState, ScannedProduct } from "../../../types/app"
import type { ClaimFormState } from "../types"
import { QrCode } from "lucide-react"

type ScannerSectionProps = {
    claimScanner: ScannerState
    setClaimScanner: Dispatch<SetStateAction<ScannerState>>
    scannedProduct: ScannedProduct | null
    setScannedProduct: Dispatch<SetStateAction<ScannedProduct | null>>
    claimForm: ClaimFormState
    setClaimForm: Dispatch<SetStateAction<ClaimFormState>>
    loadingAction: boolean
    onConfirmScannedProduct: (code: string) => void | Promise<void>
    stageScannedProduct: (rawCode: string, source?: "scan" | "manual") => void
    claimVideoRef: RefObject<HTMLVideoElement>
}

export function ScannerSection({
    claimScanner,
    setClaimScanner,
    scannedProduct,
    setScannedProduct,
    claimForm,
    setClaimForm,
    loadingAction,
    onConfirmScannedProduct,
    stageScannedProduct,
    claimVideoRef,
}: ScannerSectionProps) {
    const resetScanState = (opts?: { close?: boolean }) => {
        setScannedProduct(null)
        setClaimForm((prev) => ({ ...prev, code: "", status: "" }))
        setClaimScanner((prev) => ({ ...prev, last: "", ...(opts?.close ? { active: false } : {}) }))
    }

    const scannedStatus = scannedProduct?.status
    const isPending = scannedStatus === "pending"
    const isConfirmed = scannedStatus === "confirmed"
    const isInvalid = scannedStatus === "invalid"

    return (
        <div
            className={`fixed inset-0 z-[80] bg-black transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${claimScanner.active ? "translate-y-0" : "translate-y-[105%]"
                }`}
        >
            {/* Scanner Header UI */}
            <div className="absolute top-0 left-0 right-0 z-20 pt-12 px-6 flex justify-between items-start">
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_#f43f5e]" />
                        <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live Camera</span>
                    </div>
                </div>
                <button
                    onClick={() => resetScanState({ close: true })}
                    className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Camera Viewport */}
            <div className="absolute inset-0 bg-neutral-900">
                {!scannedProduct ? (
                    <div className="relative w-full h-full">
                        <video ref={claimVideoRef} className="w-full h-full object-cover opacity-80" autoPlay playsInline muted />

                        {/* Overlay Minimalista */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-64 h-64 border-[1.5px] border-white/30 rounded-[2rem] relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent animate-scan" />
                                {/* Esquinas Marcadas */}
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-xl" />
                            </div>
                        </div>

                        <p className="absolute bottom-32 w-full text-center text-white/80 text-sm font-medium tracking-wide drop-shadow-md">
                            Apunta el código QR dentro del marco
                        </p>
                    </div>
                ) : claimScanner.error ? (
                    // Error View
                    <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center p-8">
                        <div className="w-full max-w-sm bg-[#FFFBEA] rounded-[2.5rem] p-8 text-center shadow-2xl border border-[#6A3A30]/10">
                            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-rose-100 text-rose-600">
                                <AlertCircle size={40} />
                            </div>
                            <h3 className="text-xl font-black text-[#6A3A30] mb-2">Error de Cámara</h3>
                            <p className="text-sm text-[#6A3A30]/60 font-medium mb-8">
                                {claimScanner.error}
                            </p>
                            <button
                                onClick={() => setClaimScanner(prev => ({ ...prev, error: undefined, active: false }))}
                                className="w-full bg-[#6A3A30] text-[#FFFBEA] py-3 rounded-xl font-bold hover:bg-[#5a3128] transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                ) : (
                    // Result View
                    <div className="absolute inset-0 bg-[#6A3A30]/80 backdrop-blur-xl flex items-center justify-center p-8">
                        <div className="w-full max-w-sm bg-[#FFFBEA] rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300 border border-[#6A3A30]/10">
                            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${isConfirmed ? "bg-[#1A864D]/10 text-[#1A864D]" :
                                isInvalid ? "bg-rose-100 text-rose-600" :
                                    "bg-amber-100 text-amber-600"
                                }`}>
                                {isConfirmed ? <CheckCircle2 size={40} /> : isInvalid ? <X size={40} /> : <ScanLine size={40} />}
                            </div>

                            <h3 className="text-2xl font-black text-[#6A3A30] mb-2">
                                {isPending ? "Producto Detectado" : isConfirmed ? "¡Éxito!" : "Error"}
                            </h3>
                            <p className="text-sm text-[#6A3A30]/60 font-medium mb-8">
                                {isPending ? scannedProduct.name : isConfirmed ? "Puntos agregados correctamente" : "Código inválido o usado"}
                            </p>

                            {isPending ? (
                                <div className="space-y-3">
                                    <div className="bg-[#FFFBEA] border border-[#6A3A30]/10 rounded-2xl p-4 flex justify-between items-center mb-4">
                                        <span className="font-bold text-[#6A3A30] text-sm">{scannedProduct.points} Puntos</span>
                                        <div className="w-2 h-2 rounded-full bg-[#1A864D]" />
                                    </div>
                                    <button
                                        onClick={() => onConfirmScannedProduct(scannedProduct.code)}
                                        disabled={loadingAction}
                                        className="w-full bg-[#6A3A30] text-[#FFFBEA] py-4 rounded-xl font-bold hover:bg-[#5a3128] transition-colors shadow-lg shadow-[#6A3A30]/20"
                                    >
                                        {loadingAction ? "Procesando..." : "Confirmar y Sumar"}
                                    </button>
                                    <button onClick={() => resetScanState()} className="w-full py-3 text-[#6A3A30]/40 font-bold text-xs hover:text-[#6A3A30]">
                                        CANCELAR
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => resetScanState({ close: isConfirmed })} className="w-full bg-[#6A3A30] text-[#FFFBEA] py-4 rounded-xl font-bold hover:bg-[#5a3128] transition-colors shadow-lg">
                                    {isConfirmed ? "Entendido" : "Intentar de nuevo"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Input - Bottom Sheet style */}
            {!scannedProduct && (
                <div className="absolute bottom-0 left-0 right-0 bg-[#FFFBEA] rounded-t-[2rem] p-8 pb-10 border-t border-[#6A3A30]/10">
                    <div className="w-12 h-1.5 bg-[#6A3A30]/10 rounded-full mx-auto mb-6" />
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A3A30]/40">
                                <QrCode size={20} />
                            </div>
                            <input
                                value={claimForm.code}
                                onChange={(e) => setClaimForm({ ...claimForm, code: e.target.value })}
                                placeholder="Ingresar código manual"
                                className="w-full bg-[#6A3A30]/5 h-14 rounded-2xl pl-12 pr-4 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-[#6A3A30]/20 transition-all placeholder:font-medium placeholder:text-[#6A3A30]/30 border border-[#6A3A30]/10"
                            />
                        </div>
                        <button
                            onClick={() => stageScannedProduct(claimForm.code, "manual")}
                            disabled={!claimForm.code || loadingAction}
                            className="w-14 h-14 bg-[#6A3A30] text-[#FFFBEA] rounded-2xl flex items-center justify-center hover:bg-[#5a3128] transition-colors disabled:opacity-50 shadow-lg shadow-[#6A3A30]/20"
                        >
                            <ArrowRight size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
