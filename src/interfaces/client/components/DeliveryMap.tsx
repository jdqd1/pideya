import { useEffect, useRef } from "react"
import type { MutableRefObject } from "react"
import { MapContainer, TileLayer, useMap, useMapEvents, AttributionControl } from "react-leaflet"
import L, { type LatLngLiteral } from "leaflet"
import "leaflet/dist/leaflet.css"
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png"
import markerIconUrl from "leaflet/dist/images/marker-icon.png"
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png"
import type { DeliveryLocation } from "../../../types/app"

// Fix Leaflet marker icons
const defaultMarkerIcon = L.icon({
    iconUrl: markerIconUrl,
    iconRetinaUrl: markerIcon2xUrl,
    shadowUrl: markerShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -28],
    shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = defaultMarkerIcon

type DeliveryMapProps = {
    selected: DeliveryLocation | null;
    onSelect: (coords: LatLngLiteral, source?: DeliveryLocation["source"]) => void;
    routePath?: LatLngLiteral[];
    accent?: string;
    onFlyStart?: () => void;
    onFlyEnd?: () => void;
}

export function DeliveryMap({
    selected,
    onSelect,
    routePath,
    onFlyStart,
    onFlyEnd,
}: DeliveryMapProps) {
    const fallback = { lat: 10.4806, lng: -66.9036 }
    const focus = selected ?? routePath?.[routePath.length - 1] ?? fallback
    const center: LatLngLiteral = { lat: focus.lat, lng: focus.lng }
    const zoom = selected ? 16 : 13

    // Shared ref to coordinate between FlyTo and Tracker
    const isFlying = useRef(false)

    return (
        <div className="relative w-full h-full bg-[#AFC8BF]">
            <MapContainer
                center={center}
                zoom={zoom}
                scrollWheelZoom
                zoomControl={false}
                attributionControl={false}
                className="h-full w-full bg-[#6A3A30]"
                style={{ backgroundColor: "#6A3A30" }}
            >
                <TileLayer
                    attribution='&copy; Google Maps'
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2"
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                />
                <AttributionControl prefix={false} position="bottomright" />
                <MapCenterTracker onMoveEnd={onSelect} isFlying={isFlying} />
                <FlyToLocation
                    target={selected}
                    onStart={() => { isFlying.current = true; onFlyStart?.() }}
                    onEnd={() => { isFlying.current = false; onFlyEnd?.() }}
                />

            </MapContainer>

            {/* Fixed Center Pin Overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none flex flex-col items-center justify-center -mt-8 pb-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-[#1A864D]/30 rounded-full animate-ping delay-75"></div>
                    <div className="relative w-4 h-4 bg-[#1A864D] border-[3px] border-white rounded-full shadow-[0_0_20px_rgba(26,134,77,0.5)] z-10"></div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-[2px] h-4 bg-[#1A864D]/50 rounded-full"></div>
                </div>
            </div>
        </div >
    )
}

function MapCenterTracker({ onMoveEnd, isFlying }: { onMoveEnd: (coords: LatLngLiteral) => void, isFlying: MutableRefObject<boolean> }) {
    const map = useMap()
    useMapEvents({
        moveend: () => {
            if (isFlying.current) return
            onMoveEnd(map.getCenter())
        },
    })
    return null
}

function FlyToLocation({ target, onStart, onEnd }: { target: DeliveryLocation | null; onStart?: () => void; onEnd?: () => void }) {
    const map = useMap()
    useEffect(() => {
        if (!target) return
        const current = map.getCenter()
        const dist = map.distance(current, { lat: target.lat, lng: target.lng })

        // Only fly if distance is significant (> 20 meters)
        if (dist > 20) {
            onStart?.()
            map.flyTo({ lat: target.lat, lng: target.lng }, 16, { duration: 0.8, easeLinearity: 0.25 })
            map.once("moveend", () => {
                onEnd?.()
            })
        }
    }, [map, target]) // Warning: 'onStart', 'onEnd' dependencies omitted to avoid re-triggering effect

    return null
}
