'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapMarker {
  id: number
  lat: number
  lng: number
  nome: string
  prioridade: string
  contagem: number
}

interface PestMapProps {
  markers: MapMarker[]
}

const priorityColor: Record<string, string> = {
  ALTA: '#dc2626',
  MEDIA: '#f59e0b',
  BAIXA: '#22c55e',
}

export default function PestMap({ markers }: PestMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [-49.27, -16.68],
      zoom: 5,
    })

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    if (!map.current) return

    const existingMarkers = document.querySelectorAll('.pest-marker')
    existingMarkers.forEach(m => m.remove())

    if (markers.length === 0) return

    const bounds = new maplibregl.LngLatBounds()

    markers.forEach((marker) => {
      const color = priorityColor[marker.prioridade] ?? '#6b7280'

      const el = document.createElement('div')
      el.className = 'pest-marker'
      el.style.cssText = `
        width: ${Math.max(24, Math.min(40, marker.contagem * 4))}px;
        height: ${Math.max(24, Math.min(40, marker.contagem * 4))}px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      `
      el.textContent = String(marker.contagem)

      new maplibregl.Marker({ element: el })
        .setLngLat([marker.lng, marker.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong>${marker.nome}</strong><br/>
              <span>Contagem: ${marker.contagem}</span><br/>
              <span style="color: ${color}; font-weight: bold;">${marker.prioridade}</span>
            </div>
          `)
        )
        .addTo(map.current!)

      bounds.extend([marker.lng, marker.lat])
    })

    map.current.fitBounds(bounds, { padding: 60, maxZoom: 15 })
  }, [markers])

  return (
    <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '400px' }} />
  )
}
