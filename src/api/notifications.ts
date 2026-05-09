import { API_URL } from './config'


const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

function normalizeBase64Url(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    return (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')
}

function isIosDevice() {
    const ua = navigator.userAgent || ''
    const platform = navigator.platform || ''
    return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalonePwaMode() {
    const nav = navigator as Navigator & { standalone?: boolean }
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function isLikelyInAppBrowser() {
    const ua = navigator.userAgent || ''
    return /FBAN|FBAV|Instagram|Line|TikTok|wv|WebView|Messenger|Snapchat/i.test(ua)
}

function toBase64Url(source: ArrayBuffer | null) {
    if (!source) return null
    const bytes = new Uint8Array(source)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i])
    }
    return window
        .btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

function subscriptionMatchesVapidKey(subscription: PushSubscription, vapidPublicKey: string) {
    const currentKey = toBase64Url(subscription.options?.applicationServerKey ?? null)
    if (!currentKey) return false
    const normalizedCurrent = normalizeBase64Url(currentKey)
    const normalizedExpected = normalizeBase64Url(vapidPublicKey)
    return normalizedCurrent === normalizedExpected
}

async function resolveVapidPublicKey() {
    try {
        const res = await fetch(`${API_URL}/loyalty/public/notifications/vapid-public-key`)
        if (res.ok) {
            const data = await res.json()
            if (typeof data?.publicKey === 'string' && data.publicKey.trim()) {
                return data.publicKey.trim()
            }
        }
    } catch (error) {
        console.warn('Could not fetch backend VAPID key, falling back to frontend env key', error)
    }
    return VAPID_PUBLIC_KEY
}

async function ensureNotificationPermission() {
    if (!('Notification' in window)) {
        throw new Error('Este navegador no soporta notificaciones')
    }

    if (Notification.permission === 'granted') return

    if (Notification.permission === 'denied') {
        throw new Error('Permiso de notificaciones bloqueado. Activalo en la configuracion del navegador para este sitio.')
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
        throw new Error('No se concedio el permiso de notificaciones')
    }
}

async function ensureFreshServiceWorkerRegistration() {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
        await registration.unregister()
    }
    await navigator.serviceWorker.register('/sw.js')
    return navigator.serviceWorker.ready
}

async function createSubscription(
    registration: ServiceWorkerRegistration,
    vapidPublicKey: string,
) {
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)
    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
    })
}

function buildMobilePushHint() {
    if (isIosDevice() && !isStandalonePwaMode()) {
        return ' En iPhone/iPad debes abrir en Safari y agregar la app a la pantalla de inicio para habilitar notificaciones.'
    }
    if (isLikelyInAppBrowser()) {
        return ' Este navegador integrado no soporta push correctamente. Abre el sitio en Chrome o Safari.'
    }
    return ' Verifica permisos de notificacion del sitio y reinicia el navegador.'
}

export async function subscribeToNotifications(token: string) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push messaging is not supported')
    }

    const vapidPublicKey = await resolveVapidPublicKey()
    if (!vapidPublicKey) {
        console.error("Missing VAPID key")
        return
    }

    await ensureNotificationPermission()

    let registration = await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (subscription && !subscriptionMatchesVapidKey(subscription, vapidPublicKey)) {
        const unsubscribed = await subscription.unsubscribe()
        subscription = await registration.pushManager.getSubscription()
        if (!unsubscribed || (subscription && !subscriptionMatchesVapidKey(subscription, vapidPublicKey))) {
            throw new Error('No se pudo reemplazar una suscripcion antigua. Borra permisos/notificaciones del sitio y vuelve a intentar.')
        }
    }

    if (!subscription) {
        try {
            subscription = await createSubscription(registration, vapidPublicKey)
        } catch (error: any) {
            const details = String(error?.message ?? '')
            const lowered = details.toLowerCase()
            const recoverable =
                lowered.includes('push service error') ||
                lowered.includes('registration failed')

            if (recoverable) {
                try {
                    const previousSub = await registration.pushManager.getSubscription()
                    if (previousSub) await previousSub.unsubscribe()
                } catch {
                    // Best effort cleanup before retry.
                }

                try {
                    registration = await ensureFreshServiceWorkerRegistration()
                    subscription = await createSubscription(registration, vapidPublicKey)
                } catch (retryError: any) {
                    const retryDetails = retryError?.message ? `: ${retryError.message}` : ''
                    throw new Error(`No se pudo crear la suscripcion push${retryDetails}.${buildMobilePushHint()}`)
                }
            } else {
                const safeDetails = details ? `: ${details}` : ''
                throw new Error(`No se pudo crear la suscripcion push${safeDetails}`)
            }
        }
    }

    // Send subscription to backend
    console.log('Sending subscription to backend:', subscription)
    const res = await fetch(`${API_URL}/loyalty/notifications/subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subscription)
    })

    if (!res.ok) throw new Error('Failed to save subscription')

    return subscription
}

export async function unsubscribeFromNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
        await subscription.unsubscribe()
        console.log('Unsubscribed from notifications')
    }
}

export async function getNotificationSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return null
    }
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
}
