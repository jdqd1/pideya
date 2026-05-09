const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])

export function getGeolocationBlockReason(): string | null {
    if (typeof window === "undefined") return "Geolocalizacion no disponible."
    if (!("geolocation" in navigator)) return "Tu navegador no soporta geolocalizacion."

    const isLocalhost = LOCAL_HOSTS.has(window.location.hostname)
    const isSecureContext = typeof window.isSecureContext === "boolean"
        ? window.isSecureContext
        : window.location.protocol === "https:"
    if (!isSecureContext && !isLocalhost) {
        return "La ubicacion requiere HTTPS para funcionar."
    }

    return null
}

export async function canAutoRequestGeolocation(): Promise<boolean> {
    if (getGeolocationBlockReason()) return false
    if (!("permissions" in navigator) || typeof navigator.permissions.query !== "function") {
        return false
    }

    try {
        // En iOS y algunos navegadores, permissions.query puede no estar implementado o no soportar "geolocation"
        // En esos casos, asumimos que PODEMOS intentar pedirla (el navegador mostrará el prompt si no está bloqueado)
        const status = await navigator.permissions.query({ name: "geolocation" as PermissionName })
        return status.state === "granted" || status.state === "prompt"
    } catch {
        // Si falla la query de permisos (ej. iOS antiguo, o soporte incompleto), asumimos "prompt" (true)
        // para permitir que getCurrentPosition dispare la UI nativa.
        return true
    }
}
