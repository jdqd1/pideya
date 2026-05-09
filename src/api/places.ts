import { API_URL } from "./config"

export type PlaceSuggestion = {
  place_id: string
  display_name: string
  main_text: string
  secondary_text: string
}

type PlacesOptions = {
  publicMode?: boolean
  token?: string
}

type AutocompleteOptions = PlacesOptions & {
  locationBias?: unknown
  sessionToken?: string
}

const readJson = async (res: Response) => {
  const text = await res.text().catch(() => "")
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const authHeaders = (token?: string): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {}

const placesPath = (path: string, publicMode?: boolean) =>
  `${API_URL}/loyalty/${publicMode ? "public/" : ""}places${path}`

export const readAuthToken = () => {
  try {
    const authData = localStorage.getItem("loyalty-auth")
    return authData ? JSON.parse(authData).token as string : ""
  } catch {
    return ""
  }
}

export async function searchPlaceSuggestions(input: string, options: AutocompleteOptions = {}): Promise<PlaceSuggestion[]> {
  const res = await fetch(placesPath("/autocomplete", options.publicMode), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(options.publicMode ? undefined : options.token),
    },
    body: JSON.stringify({
      input,
      locationBias: options.locationBias,
      sessionToken: options.sessionToken,
    }),
  })

  if (!res.ok) throw new Error("No se pudo buscar la ubicacion")
  const data = await readJson(res)
  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : []

  return suggestions.map((s: any) => ({
    place_id: s.placePrediction?.placeId,
    display_name: s.placePrediction?.text?.text,
    main_text: s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || "",
    secondary_text: s.placePrediction?.structuredFormat?.secondaryText?.text || "",
  })).filter((item: PlaceSuggestion) => Boolean(item.place_id))
}

export async function fetchPlaceDetails(placeId: string, options: PlacesOptions = {}) {
  const res = await fetch(placesPath(`/${encodeURIComponent(placeId)}`, options.publicMode), {
    headers: authHeaders(options.publicMode ? undefined : options.token),
  })
  if (!res.ok) throw new Error("No se pudo obtener la ubicacion")
  return readJson(res)
}

export async function reverseGeocode(lat: number, lng: number, options: PlacesOptions = {}) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const res = await fetch(placesPath(`/reverse-geocode?${params.toString()}`, options.publicMode), {
    headers: authHeaders(options.publicMode ? undefined : options.token),
  })
  if (!res.ok) throw new Error("No se pudo obtener la direccion")
  return readJson(res)
}
