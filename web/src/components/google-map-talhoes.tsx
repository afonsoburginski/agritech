'use client'

import { useMemo, useCallback, useRef } from 'react'
import { PiSecurityCameraThin } from 'react-icons/pi'
import { useJsApiLoader, GoogleMap, Polygon, Marker, OverlayView, type Libraries } from '@react-google-maps/api'

const DEFAULT_CENTER = { lat: -11.77, lng: -55.47 }
const DEFAULT_ZOOM = 13
const LIBRARIES: Libraries = ['drawing']

/** Tema escuro para o modo mapa (roadmap). */
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'all', stylers: [{ invert_lightness: true }] },
]

/** Path do ícone PiSecurityCameraThin (Phosphor). */
const CAMERA_PATH =
  'M248,140a4,4,0,0,0-4,4v20H195.31a4,4,0,0,1-2.82-1.17l-21.18-21.17,53.18-53.17a12,12,0,0,0,0-17l-56-56a12,12,0,0,0-17,0L5.76,161.76A6,6,0,0,0,10,172H51l36.48,36.49a12,12,0,0,0,17,0l61.18-61.18,21.17,21.17a11.9,11.9,0,0,0,8.48,3.52H244v20a4,4,0,0,0,8,0V144A4,4,0,0,0,248,140ZM157.17,21.17a4.1,4.1,0,0,1,5.66,0l15.51,15.52L51,164H14.82ZM98.83,202.83a4.1,4.1,0,0,1-5.66,0L58.34,168,184,42.34l34.83,34.83a4,4,0,0,1,0,5.66Z'

/**
 * Ícone do ponto de monitoramento – igual ao MapLibre:
 * caixa p-0.5 rounded border border-white bg-gray-500/40, ícone h-5 w-5 (20px), nome text-[10px] abaixo.
 */
function getCameraMarkerIcon(nome: string): string {
  const label = nome.length > 12 ? `${nome.slice(0, 11)}…` : nome
  const labelEscaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 42" width="80" height="42">
  <!-- Caixa igual MapLibre: p-0.5 rounded border border-white bg-gray-500/40, ícone 20x20 -->
  <rect x="27" y="0" width="26" height="26" rx="4" fill="rgba(107,114,128,0.4)" stroke="white" stroke-width="1"/>
  <g transform="translate(30,3) scale(0.078125)" fill="white"><path d="${CAMERA_PATH}"/></g>
  <!-- Nome: text-[10px] font-medium mt-0.5 text-white drop-shadow-md truncate max-w-[80px] -->
  <text x="40" y="38" text-anchor="middle" font-size="10" font-weight="500" fill="white" filter="drop-shadow(0 1px 1px rgba(0,0,0,0.5))">${labelEscaped}</text>
</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export interface TalhaoForMap {
  id: number
  nome: string
  color: string | null
  coordinates: { type: 'Polygon'; coordinates: number[][][] } | null
}

export interface PontoForMap {
  id: number
  nome: string
  coordinates: { type: 'Point'; coordinates: [number, number] } | null
}

type GoogleMapTalhoesProps = {
  talhoes: TalhaoForMap[]
  pontos: PontoForMap[]
  selectedId: number | null
  selectedPontoId: number | null
  movingPontoId: number | null
  satellite: boolean
  onSelectTalhao: (id: number | null) => void
  onSelectPonto: (id: number | null) => void
  onMovePonto: (id: number) => void
  onDeletePonto: (id: number) => void
  onPontoDragEnd: (id: number, lng: number, lat: number) => void
  className?: string
  isLoaded?: boolean
  loadError?: Error | undefined
}

function polygonPath(coord: number[][][]): { lat: number; lng: number }[] {
  const ring = coord[0]
  if (!ring?.length) return []
  return ring.map(([lng, lat]) => ({ lat, lng }))
}

export function GoogleMapTalhoes({
  talhoes,
  pontos,
  selectedId,
  selectedPontoId,
  movingPontoId,
  satellite,
  onSelectTalhao,
  onSelectPonto,
  onMovePonto,
  onDeletePonto,
  onPontoDragEnd,
  className = '',
  isLoaded: isLoadedProp,
  loadError: loadErrorProp,
}: GoogleMapTalhoesProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { isLoaded: isLoadedHook, loadError: loadErrorHook } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? '',
    libraries: LIBRARIES,
  })
  const isLoaded = isLoadedProp ?? isLoadedHook
  const loadError = loadErrorProp ?? loadErrorHook

  const mapType = satellite ? 'satellite' : 'roadmap'
  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      map.setMapTypeId(mapType as 'roadmap' | 'satellite')
    },
    [mapType],
  )
  const markerRefsByPontoId = useRef<Map<number, google.maps.Marker>>(new Map())

  const polygonsWithPath = useMemo(() => {
    return talhoes
      .filter((t) => t.coordinates?.coordinates?.[0])
      .map((t) => ({
        ...t,
        path: polygonPath(t.coordinates!.coordinates),
      }))
      .filter((t) => t.path.length >= 3)
  }, [talhoes])

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 rounded-xl ${className}`}>
        <p className="text-sm text-muted-foreground">Falha ao carregar o Google Maps. Verifique a API key.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 rounded-xl ${className}`}>
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 rounded-xl ${className}`}>
        <p className="text-sm text-muted-foreground">Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no .env.local</p>
      </div>
    )
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <GoogleMap
        mapContainerClassName="w-full h-full rounded-xl"
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        mapTypeId={mapType}
        onLoad={onMapLoad}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          ...(satellite ? {} : { styles: DARK_MAP_STYLES }),
        }}
      >
        {polygonsWithPath.map((t) => (
        <Polygon
          key={t.id}
          paths={t.path}
          options={{
            fillColor: t.color ?? '#22c55e',
            fillOpacity: selectedId === t.id ? 0.45 : 0.2,
            strokeColor: t.color ?? '#22c55e',
            strokeWeight: selectedId === t.id ? 4 : 2.5,
          }}
          onClick={() => onSelectTalhao(selectedId === t.id ? null : t.id)}
        />
        ))}
        {pontos
        .filter((p) => p.coordinates?.coordinates)
        .map((p) => {
          const [lng, lat] = p.coordinates!.coordinates
          const isSelected = selectedPontoId === p.id
          const isMoving = movingPontoId === p.id

          if (isMoving) {
            return (
              <Marker
                key={`moving-${p.id}`}
                position={{ lat, lng }}
                icon={{
                  url: getCameraMarkerIcon(p.nome),
                  scaledSize: new google.maps.Size(80, 42),
                  anchor: new google.maps.Point(40, 0),
                }}
                draggable
                onLoad={(m) => { markerRefsByPontoId.current.set(p.id, m) }}
                onDragEnd={() => {
                  const pos = markerRefsByPontoId.current.get(p.id)?.getPosition()
                  if (pos) onPontoDragEnd(p.id, pos.lng(), pos.lat())
                }}
                zIndex={1}
              />
            )
          }

          return (
            <OverlayView
              key={p.id}
              position={{ lat, lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h })}
              zIndex={isSelected ? 1 : 0}
            >
              <div
                className="flex flex-col items-center gap-1 cursor-pointer"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectPonto(isSelected ? null : p.id)
                }}
              >
                <div className="flex flex-col items-center transition-opacity hover:opacity-90">
                  <div className="p-0.5 rounded border border-white bg-gray-500/40">
                    <PiSecurityCameraThin className="h-5 w-5 text-white drop-shadow-md" />
                  </div>
                  <span className="text-[10px] font-medium mt-0.5 px-1 text-white drop-shadow-md truncate max-w-[80px]">
                    {p.nome}
                  </span>
                </div>
                {isSelected && (
                  <div className="flex gap-0.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-white bg-white/60 text-gray-900 hover:bg-white/80 shadow"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMovePonto(p.id)
                      }}
                    >
                      Mover
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-red-400 bg-red-500/60 text-white hover:bg-red-500/80 shadow"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeletePonto(p.id)
                      }}
                    >
                      Deletar
                    </button>
                  </div>
                )}
              </div>
            </OverlayView>
          )
        })}
      </GoogleMap>
    </div>
  )
}
