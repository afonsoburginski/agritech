'use client'

import { useEffect, useRef } from 'react'
import MapLibreGL from 'maplibre-gl'
import { Map, MapControls, MapMarker, MarkerContent, MarkerPopup } from '@/components/ui/map'

export interface PestMapMarker {
  id: number
  lat: number
  lng: number
  nome: string
  prioridade: string
  contagem: number
}

const priorityColor: Record<string, string> = {
  ALTA: '#dc2626',
  MEDIA: '#f59e0b',
  BAIXA: '#22c55e',
}

interface PestMapMapcnProps {
  markers: PestMapMarker[]
  className?: string
}

export function PestMapMapcn({ markers, className }: PestMapMapcnProps) {
  const mapRef = useRef<MapLibreGL.Map | null>(null)

  useEffect(() => {
    if (markers.length === 0) return
    const id = setTimeout(() => {
      const map = mapRef.current
      if (!map) return
      const bounds = new MapLibreGL.LngLatBounds()
      markers.forEach((m) => bounds.extend([m.lng, m.lat]))
      map.fitBounds(bounds, { padding: 48, maxZoom: 14 })
    }, 400)
    return () => clearTimeout(id)
  }, [markers])

  return (
    <Map
      ref={mapRef}
      theme="dark"
      className={className}
      center={[-49.27, -16.68]}
      zoom={5}
    >
      <MapControls position="bottom-right" showZoom showLocate />
      {markers.map((marker) => (
        <MapMarker key={marker.id} longitude={marker.lng} latitude={marker.lat}>
          <MarkerContent>
            <div
              className="h-5 w-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white"
              style={{
                backgroundColor: priorityColor[marker.prioridade] ?? '#6b7280',
                minWidth: Math.max(20, Math.min(36, marker.contagem * 3)) + 'px',
                minHeight: Math.max(20, Math.min(36, marker.contagem * 3)) + 'px',
              }}
            >
              {marker.contagem}
            </div>
          </MarkerContent>
          <MarkerPopup>
            <div className="text-sm">
              <p className="font-semibold">{marker.nome}</p>
              <p className="text-muted-foreground">Contagem: {marker.contagem}</p>
              <p
                className="font-medium"
                style={{ color: priorityColor[marker.prioridade] ?? undefined }}
              >
                {marker.prioridade}
              </p>
            </div>
          </MarkerPopup>
        </MapMarker>
      ))}
    </Map>
  )
}
