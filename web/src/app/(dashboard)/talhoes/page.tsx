'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Layers,
  Plus,
  Trash2,
  Check,
  X,
  Undo2,
  Satellite,
  Map as MapIconLucide,
  Move,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { PiSecurityCameraThin } from 'react-icons/pi'
import MapLibreGL from 'maplibre-gl'
import { Map, MapControls, MapMarker, MarkerContent, useMap } from '@/components/ui/map'
import { useSupabaseQuery, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

/* ─── types ─── */

interface TalhaoData {
  id: number
  fazenda_id: number
  nome: string
  area: number | string | null
  coordinates: { type: 'Polygon'; coordinates: number[][][] } | null
  color: string | null
  cultura_atual: string | null
}

interface FazendaOption {
  id: number
  nome: string
}

interface PontoMonitoramentoData {
  id: number
  fazenda_id: number
  talhao_id: number | null
  nome: string
  coordinates: { type: 'Point'; coordinates: [number, number] } | null
}

/* ─── constants ─── */

const CULTURA_OPTIONS = [
  { value: 'SOJA', label: 'Soja' },
  { value: 'MILHO', label: 'Milho' },
  { value: 'ALGODAO', label: 'Algodão' },
  { value: 'TRIGO', label: 'Trigo' },
  { value: 'CAFE', label: 'Café' },
  { value: 'FEIJAO', label: 'Feijão' },
  { value: 'OUTROS', label: 'Outros' },
]

const TALHAO_COLORS = [
  '#22c55e', '#eab308', '#f97316', '#14b8a6', '#10b981',
  '#3b82f6', '#8b5cf6', '#ec4899', '#84cc16', '#06b6d4',
]

const CULTURA_LABEL: Record<string, string> = Object.fromEntries(
  CULTURA_OPTIONS.map(c => [c.value, c.label]),
)

const SAT_STYLE = {
  version: 8 as const,
  sources: {
    satellite: {
      type: 'raster' as const,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [{ id: 'satellite-base', type: 'raster' as const, source: 'satellite' }],
} satisfies MapLibreGL.StyleSpecification

/* ─── helpers ─── */

function calculateAreaHa(ring: number[][]): number {
  if (ring.length < 3) return 0
  const n = ring.length
  const centerLat = ring.reduce((s, c) => s + c[1], 0) / n
  const mLat = 111320
  const mLng = 111320 * Math.cos((centerLat * Math.PI) / 180)
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += ring[i][0] * mLng * ring[j][1] * mLat - ring[j][0] * mLng * ring[i][1] * mLat
  }
  return Math.abs(area / 2) / 10000
}

function buildTalhoesGeoJSON(
  talhoes: TalhaoData[],
  selectedId: number | null,
  editId: number | null,
  editCoords: number[][] | null,
  selectedColorOverride: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: talhoes
      .filter(t => t.coordinates)
      .map(t => {
        const isEditing = t.id === editId && editCoords
        const color = t.id === selectedId && selectedColorOverride ? selectedColorOverride : (t.color ?? '#22c55e')
        return {
          type: 'Feature' as const,
          id: t.id,
          properties: {
            id: t.id,
            nome: t.nome,
            color,
            selected: t.id === selectedId,
          },
          geometry: isEditing
            ? { type: 'Polygon' as const, coordinates: [[...editCoords, editCoords[0]]] }
            : t.coordinates!,
        }
      }),
  }
}

function buildDrawingGeoJSON(vertices: number[][], mousePos: number[] | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  const allPts = mousePos ? [...vertices, mousePos] : vertices

  if (allPts.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { kind: 'outline' },
      geometry: { type: 'LineString', coordinates: [...allPts, allPts[0]] },
    })
  }
  if (allPts.length >= 3) {
    features.push({
      type: 'Feature',
      properties: { kind: 'fill' },
      geometry: { type: 'Polygon', coordinates: [[...allPts, allPts[0]]] },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildGuideLineGeoJSON(vertices: number[][], mousePos: number[] | null): GeoJSON.FeatureCollection {
  if (!mousePos || vertices.length === 0) return { type: 'FeatureCollection', features: [] }
  const coords = [vertices[vertices.length - 1], mousePos]
  if (vertices.length >= 2) coords.push(vertices[0])
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }],
  }
}

function pointInPolygon(lng: number, lat: number, ring: number[][]): boolean {
  const n = ring.length
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

function findTalhaoIdAtPoint(lng: number, lat: number, talhoes: TalhaoData[]): number | null {
  for (const t of talhoes) {
    const ring = t.coordinates?.coordinates?.[0]
    if (!ring) continue
    if (pointInPolygon(lng, lat, ring)) return t.id
  }
  return null
}

/* ─── TalhoesMapContent ─── */

type MapMode = 'view' | 'draw' | 'edit-shape' | 'add-point'

function TalhoesMapContent({
  talhoes,
  pontos,
  selectedId,
  selectedColorOverride,
  selectedPontoId,
  mode,
  drawVertices,
  editCoords,
  onSelect,
  onMapClick,
  onAddPointClick,
  onSelectPonto,
  onDeletePonto,
  onMovePonto,
  movingPontoId,
  onPontoDragEnd,
  onVertexDrag,
  onDrawVertexDrag,
  fazendaId,
}: {
  talhoes: TalhaoData[]
  pontos: PontoMonitoramentoData[]
  selectedId: number | null
  selectedColorOverride: string | null
  selectedPontoId: number | null
  mode: MapMode
  drawVertices: number[][]
  editCoords: number[][] | null
  onSelect: (id: number | null) => void
  onMapClick: (lng: number, lat: number) => void
  onAddPointClick: (lng: number, lat: number) => void
  onSelectPonto: (id: number | null) => void
  onDeletePonto: (id: number) => void
  onMovePonto: (id: number) => void
  movingPontoId: number | null
  onPontoDragEnd: (id: number, lng: number, lat: number) => void
  onVertexDrag: (index: number, lng: number, lat: number) => void
  onDrawVertexDrag: (index: number, lng: number, lat: number) => void
  fazendaId: number | null
}) {
  const { map, isLoaded } = useMap()
  const modeRef = useRef(mode)
  modeRef.current = mode
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onAddPointClickRef = useRef(onAddPointClick)
  onAddPointClickRef.current = onAddPointClick
  const fittedRef = useRef<number | null>(null)
  const mousePosRef = useRef<number[] | null>(null)
  const drawVerticesRef = useRef(drawVertices)
  drawVerticesRef.current = drawVertices

  useEffect(() => {
    if (!isLoaded || !map) return

    const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

    if (!map.getSource('talhoes')) {
      map.addSource('talhoes', { type: 'geojson', data: emptyFC })
      map.addLayer({
        id: 'talhoes-fill',
        type: 'fill',
        source: 'talhoes',
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#22c55e'],
          'fill-opacity': ['case', ['==', ['get', 'selected'], true], 0.45, 0.2],
        },
      })
      map.addLayer({
        id: 'talhoes-outline',
        type: 'line',
        source: 'talhoes',
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#22c55e'],
          'line-width': ['case', ['==', ['get', 'selected'], true], 4, 2.5],
          'line-opacity': 1,
        },
      })
      map.addLayer({
        id: 'talhoes-labels',
        type: 'symbol',
        source: 'talhoes',
        layout: {
          'text-field': ['get', 'nome'],
          'text-size': 12,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.6)',
          'text-halo-width': 1.5,
        },
      })
    }

    if (!map.getSource('drawing')) {
      map.addSource('drawing', { type: 'geojson', data: emptyFC })
      map.addLayer({
        id: 'drawing-fill',
        type: 'fill',
        source: 'drawing',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 },
        filter: ['==', '$type', 'Polygon'],
      })
      map.addLayer({
        id: 'drawing-line',
        type: 'line',
        source: 'drawing',
        paint: { 'line-color': '#3b82f6', 'line-width': 2 },
      })
    }

    if (!map.getSource('guide')) {
      map.addSource('guide', { type: 'geojson', data: emptyFC })
      map.addLayer({
        id: 'guide-line',
        type: 'line',
        source: 'guide',
        paint: { 'line-color': '#3b82f6', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.6 },
      })
    }

    return () => {
      try {
        ;['guide-line', 'talhoes-labels', 'talhoes-outline', 'talhoes-fill', 'drawing-fill', 'drawing-line'].forEach(l => {
          if (map.getLayer(l)) map.removeLayer(l)
        })
        ;['talhoes', 'drawing', 'guide'].forEach(s => {
          if (map.getSource(s)) map.removeSource(s)
        })
      } catch { /* style already removed them */ }
    }
  }, [isLoaded, map])

  useEffect(() => {
    if (!isLoaded || !map || !map.getSource('talhoes')) return
    const src = map.getSource('talhoes') as MapLibreGL.GeoJSONSource
    src.setData(
      buildTalhoesGeoJSON(talhoes, selectedId, mode === 'edit-shape' ? selectedId : null, editCoords, selectedColorOverride),
    )
  }, [isLoaded, map, talhoes, selectedId, selectedColorOverride, mode, editCoords])

  useEffect(() => {
    if (!isLoaded || !map || !map.getSource('drawing')) return
    const src = map.getSource('drawing') as MapLibreGL.GeoJSONSource
    const useMouse = mode === 'draw'
    src.setData(buildDrawingGeoJSON(drawVertices, useMouse ? mousePosRef.current : null))
  }, [isLoaded, map, mode, drawVertices])

  useEffect(() => {
    if (!isLoaded || !map) return

    const moveHandler = (e: MapLibreGL.MapMouseEvent) => {
      if (modeRef.current !== 'draw') return
      mousePosRef.current = [e.lngLat.lng, e.lngLat.lat]

      const verts = drawVerticesRef.current
      const mp = mousePosRef.current

      const drawingSrc = map.getSource('drawing') as MapLibreGL.GeoJSONSource | undefined
      if (drawingSrc) drawingSrc.setData(buildDrawingGeoJSON(verts, mp))

      const guideSrc = map.getSource('guide') as MapLibreGL.GeoJSONSource | undefined
      if (guideSrc) guideSrc.setData(buildGuideLineGeoJSON(verts, mp))
    }

    map.on('mousemove', moveHandler)
    return () => { map.off('mousemove', moveHandler) }
  }, [isLoaded, map])

  useEffect(() => {
    if (!isLoaded || !map) return
    if (mode !== 'draw') {
      mousePosRef.current = null
      const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      const guideSrc = map.getSource('guide') as MapLibreGL.GeoJSONSource | undefined
      if (guideSrc) guideSrc.setData(emptyFC)
      const drawingSrc = map.getSource('drawing') as MapLibreGL.GeoJSONSource | undefined
      if (drawingSrc) drawingSrc.setData(emptyFC)
    }
  }, [isLoaded, map, mode])

  useEffect(() => {
    if (!isLoaded || !map) return

    const handler = (e: MapLibreGL.MapMouseEvent) => {
      if (modeRef.current === 'draw') {
        onMapClickRef.current(e.lngLat.lng, e.lngLat.lat)
        return
      }
      if (modeRef.current === 'add-point') {
        onAddPointClickRef.current(e.lngLat.lng, e.lngLat.lat)
        return
      }
      if (modeRef.current === 'edit-shape') return

      const features = map.queryRenderedFeatures(e.point, { layers: ['talhoes-fill'] })
      if (features.length) {
        onSelectRef.current((features[0].properties as { id?: number })?.id ?? null)
      } else {
        onSelectRef.current(null)
      }
    }

    const enterHandler = () => {
      if (modeRef.current === 'view') map.getCanvas().style.cursor = 'pointer'
    }
    const leaveHandler = () => {
      if (modeRef.current === 'view') map.getCanvas().style.cursor = ''
    }

    map.on('click', handler)
    map.on('mouseenter', 'talhoes-fill', enterHandler)
    map.on('mouseleave', 'talhoes-fill', leaveHandler)

    return () => {
      map.off('click', handler)
      try {
        map.off('mouseenter', 'talhoes-fill', enterHandler)
        map.off('mouseleave', 'talhoes-fill', leaveHandler)
      } catch { /* layer may have been removed */ }
    }
  }, [isLoaded, map])

  useEffect(() => {
    if (!map) return
    map.getCanvas().style.cursor = (mode === 'draw' || mode === 'add-point') ? 'crosshair' : ''
  }, [map, mode])

  useEffect(() => {
    if (!map || fittedRef.current === fazendaId) return
    fittedRef.current = fazendaId
    const bounds = new MapLibreGL.LngLatBounds()
    let hasBounds = false
    for (const t of talhoes) {
      const ring = t.coordinates?.coordinates?.[0]
      if (!ring) continue
      for (const [lng, lat] of ring) {
        bounds.extend([lng, lat])
        hasBounds = true
      }
    }
    for (const p of pontos) {
      const c = p.coordinates?.coordinates
      if (c) {
        bounds.extend([c[0], c[1]])
        hasBounds = true
      }
    }
    if (hasBounds) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 })
    }
  }, [map, talhoes, pontos, fazendaId])

  return (
    <>
      {pontos.filter(p => p.coordinates?.coordinates).map(p => {
        const isSelected = p.id === selectedPontoId
        const isMoving = p.id === movingPontoId
        const [lng, lat] = p.coordinates!.coordinates
        if (isMoving) {
          return (
            <MapMarker
              key={`ponto-${p.id}`}
              longitude={lng}
              latitude={lat}
              draggable
              onDragEnd={lngLat => onPontoDragEnd(p.id, lngLat.lng, lngLat.lat)}
            >
              <MarkerContent>
                <div className="flex flex-col items-center">
                  <div className="p-0.5 cursor-grab active:cursor-grabbing rounded border border-white bg-gray-500/40">
                    <PiSecurityCameraThin className="h-5 w-5 text-white drop-shadow-md" />
                  </div>
                  <span className="text-[10px] font-medium mt-0.5 text-white drop-shadow-md">Arraste para mover</span>
                </div>
              </MarkerContent>
            </MapMarker>
          )
        }
        return (
          <MapMarker key={`ponto-${p.id}`} longitude={lng} latitude={lat}>
            <MarkerContent>
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (mode === 'view') onSelectPonto(isSelected ? null : p.id) }}
                  className={`flex flex-col items-center transition-opacity hover:opacity-90 ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-black/30 rounded-lg' : ''}`}
                >
                  <div className="p-0.5 rounded border border-white bg-gray-500/40">
                    <PiSecurityCameraThin className="h-5 w-5 text-white drop-shadow-md" />
                  </div>
                  <span className="text-[10px] font-medium mt-0.5 px-1 text-white drop-shadow-md truncate max-w-[80px]">{p.nome}</span>
                </button>
                {isSelected && (
                  <div className="flex gap-0.5 mt-0.5">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onMovePonto(p.id) }}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-white bg-white/60 text-gray-900 hover:bg-white/80 shadow"
                    >
                      Mover
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onDeletePonto(p.id) }}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-red-400 bg-red-500/60 text-white hover:bg-red-500/80 shadow"
                    >
                      Deletar
                    </button>
                  </div>
                )}
              </div>
            </MarkerContent>
          </MapMarker>
        )
      })}
      {mode === 'draw' &&
        drawVertices.map((v, i) => (
          <MapMarker
            key={`draw-${i}`}
            longitude={v[0]}
            latitude={v[1]}
            draggable
            onDragEnd={lngLat => onDrawVertexDrag(i, lngLat.lng, lngLat.lat)}
          >
            <MarkerContent>
              <div className="h-4 w-4 rounded-full bg-blue-500 border-2 border-white shadow-lg cursor-grab active:cursor-grabbing" />
            </MarkerContent>
          </MapMarker>
        ))}
      {mode === 'edit-shape' &&
        editCoords?.map((v, i) => (
          <MapMarker
            key={`edit-${i}`}
            longitude={v[0]}
            latitude={v[1]}
            draggable
            onDragEnd={lngLat => onVertexDrag(i, lngLat.lng, lngLat.lat)}
          >
            <MarkerContent>
              <div className="h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-lg cursor-grab active:cursor-grabbing" />
            </MarkerContent>
          </MapMarker>
        ))}
    </>
  )
}

/* ─── page ─── */

export default function TalhoesPage() {
  const mapRef = useRef<MapLibreGL.Map | null>(null)
  const [satellite, setSatellite] = useState(false)
  const [fazendaId, setFazendaId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedPontoId, setSelectedPontoId] = useState<number | null>(null)
  const [movingPontoId, setMovingPontoId] = useState<number | null>(null)
  const [mode, setMode] = useState<MapMode>('view')
  const [drawVertices, setDrawVertices] = useState<number[][]>([])
  const [editCoords, setEditCoords] = useState<number[][] | null>(null)
  const [saving, setSaving] = useState(false)

  const [formNome, setFormNome] = useState('')
  const [formCultura, setFormCultura] = useState('')
  const [formColor, setFormColor] = useState('')

  const { data: fazendas } = useSupabaseQuery<FazendaOption[]>(
    queryKeys.fazendas.list(),
    async sb => {
      const {
        data: { user },
      } = await sb.auth.getUser()
      if (!user) return []
      const { data: uf } = await sb.from('user_fazendas').select('fazenda_id').eq('user_id', user.id)
      const ids = (uf ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (!ids.length) return []
      const { data } = await sb.from('fazendas').select('id, nome').in('id', ids)
      return (data ?? []) as FazendaOption[]
    },
  )

  useEffect(() => {
    if (fazendas?.length && fazendaId == null) setFazendaId(fazendas[0].id)
  }, [fazendas, fazendaId])

  const { data: talhoes, refetch } = useSupabaseQuery<TalhaoData[]>(
    ['talhoes', fazendaId],
    async sb => {
      if (fazendaId == null) return []
      const { data } = await sb
        .from('talhoes')
        .select('id, fazenda_id, nome, area, coordinates, color, cultura_atual')
        .eq('fazenda_id', fazendaId)
        .order('nome')
      return (data ?? []) as TalhaoData[]
    },
    { enabled: fazendaId != null },
  )

  const { data: pontos, refetch: refetchPontos } = useSupabaseQuery<PontoMonitoramentoData[]>(
    ['pontos_monitoramento', fazendaId],
    async sb => {
      if (fazendaId == null) return []
      const { data } = await sb
        .from('pontos_monitoramento')
        .select('id, fazenda_id, talhao_id, nome, coordinates')
        .eq('fazenda_id', fazendaId)
        .order('id')
      return (data ?? []) as PontoMonitoramentoData[]
    },
    { enabled: fazendaId != null },
  )

  const talhoesData = talhoes ?? []
  const pontosData = pontos ?? []
  const selected = talhoesData.find(t => t.id === selectedId) ?? null
  const selectedPonto = pontosData.find(p => p.id === selectedPontoId) ?? null

  useEffect(() => {
    if (selected) {
      setFormNome(selected.nome ?? '')
      setFormCultura(selected.cultura_atual ?? '')
      setFormColor(selected.color ?? TALHAO_COLORS[0])
    }
  }, [selected])

  const handleSelect = useCallback(
    (id: number | null) => {
      if (mode !== 'view') return
      setSelectedId(id)
      setSelectedPontoId(null)
    },
    [mode],
  )

  const handleSelectPonto = useCallback(
    (id: number | null) => {
      if (mode !== 'view') return
      setSelectedPontoId(id)
      setSelectedId(null)
    },
    [mode],
  )

  const handleDeletePonto = useCallback(async (id: number) => {
    setSaving(true)
    await supabase.from('pontos_monitoramento').delete().eq('id', id)
    setSelectedPontoId(null)
    setMovingPontoId(null)
    await refetchPontos()
    setSaving(false)
  }, [refetchPontos])

  const handleMovePonto = useCallback((id: number) => {
    setMovingPontoId(id)
  }, [])

  const handlePontoDragEnd = useCallback(
    async (id: number, lng: number, lat: number) => {
      setSaving(true)
      await supabase
        .from('pontos_monitoramento')
        .update({ coordinates: { type: 'Point', coordinates: [lng, lat] } })
        .eq('id', id)
      setMovingPontoId(null)
      await refetchPontos()
      setSaving(false)
    },
    [refetchPontos],
  )

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (mode === 'draw') setDrawVertices(prev => [...prev, [lng, lat]])
    },
    [mode],
  )

  const handleAddPointClick = useCallback(
    async (lng: number, lat: number) => {
      if (fazendaId == null) return
      const talhaoId = findTalhaoIdAtPoint(lng, lat, talhoesData)
      const nome = `Ponto ${pontosData.length + 1}`
      setSaving(true)
      const { error } = await supabase.from('pontos_monitoramento').insert({
        fazenda_id: fazendaId,
        talhao_id: talhaoId,
        nome,
        coordinates: { type: 'Point', coordinates: [lng, lat] },
      })
      if (!error) await refetchPontos()
      setSaving(false)
    },
    [fazendaId, talhoesData, pontosData.length, refetchPontos],
  )

  const handleStartAddPoint = () => {
    setSelectedId(null)
    setSelectedPontoId(null)
    setMode('add-point')
  }

  const handleCancelAddPoint = () => setMode('view')

  const handleVertexDrag = useCallback((index: number, lng: number, lat: number) => {
    setEditCoords(prev => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = [lng, lat]
      return next
    })
  }, [])

  const handleDrawVertexDrag = useCallback((index: number, lng: number, lat: number) => {
    setDrawVertices(prev => {
      const next = [...prev]
      next[index] = [lng, lat]
      return next
    })
  }, [])

  const handleStartDraw = () => {
    setSelectedId(null)
    setSelectedPontoId(null)
    setMode('draw')
    setDrawVertices([])
  }

  const handleCancelDraw = () => {
    setMode('view')
    setDrawVertices([])
  }

  const handleUndoVertex = () => setDrawVertices(prev => prev.slice(0, -1))

  const handleFinishDraw = async () => {
    if (drawVertices.length < 3 || fazendaId == null) return
    setSaving(true)
    const ring = [...drawVertices, drawVertices[0]]
    const area = calculateAreaHa(ring)
    const colorIndex = talhoesData.length % TALHAO_COLORS.length
    const nome = `Talhão ${talhoesData.length + 1}`

    const { data: inserted, error } = await supabase
      .from('talhoes')
      .insert({
        fazenda_id: fazendaId,
        nome,
        area: Math.round(area * 100) / 100,
        coordinates: { type: 'Polygon', coordinates: [ring] },
        color: TALHAO_COLORS[colorIndex],
        cultura_atual: 'OUTROS',
      })
      .select('id')
      .single()

    if (!error && inserted) {
      await refetch()
      setSelectedId(inserted.id)
    }
    setMode('view')
    setDrawVertices([])
    setSaving(false)
  }

  const handleStartEditShape = () => {
    if (!selected?.coordinates?.coordinates?.[0]) return
    const ring = selected.coordinates.coordinates[0]
    const isRingClosed =
      ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    setEditCoords(isRingClosed ? ring.slice(0, -1) : [...ring])
    setMode('edit-shape')
  }

  const handleCancelEditShape = () => {
    setMode('view')
    setEditCoords(null)
  }

  const handleSaveEditShape = async () => {
    if (!editCoords || editCoords.length < 3 || selectedId == null) return
    setSaving(true)
    const ring = [...editCoords, editCoords[0]]
    const area = calculateAreaHa(ring)
    await supabase
      .from('talhoes')
      .update({
        coordinates: { type: 'Polygon', coordinates: [ring] },
        area: Math.round(area * 100) / 100,
      })
      .eq('id', selectedId)
    await refetch()
    setMode('view')
    setEditCoords(null)
    setSaving(false)
  }

  const handleSaveProperties = async () => {
    if (selectedId == null) return
    setSaving(true)
    await supabase
      .from('talhoes')
      .update({
        nome: formNome,
        cultura_atual: formCultura || null,
        color: formColor,
      })
      .eq('id', selectedId)
    await refetch()
    setSaving(false)
  }

  const handleDelete = async () => {
    if (selectedId == null) return
    setSaving(true)
    await supabase.from('talhoes').delete().eq('id', selectedId)
    setSelectedId(null)
    await refetch()
    setSaving(false)
  }

  const computedArea = useMemo(() => {
    if (mode === 'edit-shape' && editCoords && editCoords.length >= 3) {
      return calculateAreaHa([...editCoords, editCoords[0]])
    }
    if (selected?.area != null) return Number(selected.area)
    return null
  }, [mode, editCoords, selected])

  const [listOpen, setListOpen] = useState(true)

  return (
    <div className="relative rounded-xl overflow-hidden border" style={{ height: 'calc(100vh - 7rem)' }}>
      <Map
        ref={mapRef}
        center={[-55.47, -11.77]}
        zoom={13}
        styles={satellite ? { light: SAT_STYLE, dark: SAT_STYLE } : undefined}
      >
        <MapControls position="bottom-right" showZoom />
        <TalhoesMapContent
          talhoes={talhoesData}
          pontos={pontosData}
          selectedId={selectedId}
          selectedColorOverride={selectedId != null ? formColor : null}
          selectedPontoId={selectedPontoId}
          mode={mode}
          drawVertices={drawVertices}
          editCoords={editCoords}
          onSelect={handleSelect}
          onMapClick={handleMapClick}
          onAddPointClick={handleAddPointClick}
          onSelectPonto={handleSelectPonto}
          onDeletePonto={handleDeletePonto}
          onMovePonto={handleMovePonto}
          movingPontoId={movingPontoId}
          onPontoDragEnd={handlePontoDragEnd}
          onVertexDrag={handleVertexDrag}
          onDrawVertexDrag={handleDrawVertexDrag}
          fazendaId={fazendaId}
        />
      </Map>

      {/* ── Top-right: satellite + fazenda ── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {fazendas && fazendas.length > 1 && (
          <Select
            value={String(fazendaId)}
            onValueChange={v => { setFazendaId(Number(v)); setSelectedId(null); setSelectedPontoId(null); setMovingPontoId(null); setMode('view'); setDrawVertices([]) }}
          >
            <SelectTrigger className="h-8 w-44 bg-background/90 backdrop-blur text-xs shadow-sm">
              <SelectValue placeholder="Fazenda" />
            </SelectTrigger>
            <SelectContent>
              {fazendas.map(f => (
                <SelectItem key={f.id} value={String(f.id)}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <button
          onClick={() => setSatellite(s => !s)}
          className="flex items-center gap-1.5 rounded-md border bg-background/90 backdrop-blur px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-accent transition-colors"
        >
          {satellite ? <MapIconLucide className="h-3.5 w-3.5" /> : <Satellite className="h-3.5 w-3.5" />}
          {satellite ? 'Mapa' : 'Satélite'}
        </button>
      </div>

      {/* ── Top-center: drawing / edit-shape toolbar ── */}
      {mode === 'draw' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg border bg-background/90 backdrop-blur shadow-lg px-3 py-2">
          <div className="text-xs mr-1">
            <span className="font-semibold">Desenho</span>
            <span className="text-muted-foreground ml-1.5">{drawVertices.length} pt{drawVertices.length !== 1 ? 's' : ''}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleUndoVertex} disabled={drawVertices.length === 0} className="h-7 px-2">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={handleFinishDraw} disabled={drawVertices.length < 3 || saving} className="h-7 px-3">
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Finalizar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelDraw} className="h-7 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {mode === 'edit-shape' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg border bg-background/90 backdrop-blur shadow-lg px-3 py-2">
          <div className="text-xs mr-1">
            <span className="font-semibold">Editando polígono</span>
            {computedArea != null && (
              <span className="text-muted-foreground ml-1.5">{computedArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha</span>
            )}
          </div>
          <Button size="sm" onClick={handleSaveEditShape} disabled={saving} className="h-7 px-3">
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelEditShape} className="h-7 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {mode === 'add-point' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg border bg-background/90 backdrop-blur shadow-lg px-3 py-2">
          <PiSecurityCameraThin className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Clique no mapa para colocar câmera/armadilha</span>
          <Button size="sm" variant="ghost" onClick={handleCancelAddPoint} className="h-7 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Bottom-left: talhões list (collapsible) ── */}
      {mode === 'view' && (
        <div className="absolute bottom-3 left-3 z-10 w-64">
          <div className="rounded-lg border bg-background/90 backdrop-blur shadow-lg overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setListOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold">
                  {talhoesData.length} talhão{talhoesData.length !== 1 ? 'ões' : ''}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {talhoesData.reduce((s, t) => s + (Number(t.area) || 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ha
                </span>
              </div>
              {listOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            {listOpen && (
              <div className="border-t max-h-52 overflow-y-auto">
                {talhoesData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum talhão</p>
                ) : (
                  talhoesData.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                        t.id === selectedId ? 'bg-primary/15' : 'hover:bg-accent/40'
                      }`}
                    >
                      <div className="h-5 w-5 rounded shrink-0" style={{ backgroundColor: t.color ?? '#22c55e' }} />
                      <span className="font-medium truncate flex-1">{t.nome}</span>
                      <span className="text-muted-foreground shrink-0">
                        {t.area != null ? `${Number(t.area).toLocaleString('pt-BR')} ha` : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Actions */}
            <div className="border-t px-2 py-1.5 space-y-0.5">
              <Button size="sm" variant="ghost" onClick={handleStartDraw} className="w-full h-7 text-xs justify-start">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Novo Talhão
              </Button>
              <Button size="sm" variant="ghost" onClick={handleStartAddPoint} className="w-full h-7 text-xs justify-start">
                <PiSecurityCameraThin className="mr-1.5 h-3.5 w-3.5" />
                Adicionar ponto de monitoramento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Right panel: selected talhão edit (floating card) ── */}
      {selected && mode === 'view' && (
        <div className="absolute top-14 right-3 z-10 w-72 rounded-lg border bg-background/90 backdrop-blur shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-semibold truncate">{selected.nome}</span>
            <button onClick={() => setSelectedId(null)} className="p-0.5 rounded hover:bg-accent transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-[11px] text-muted-foreground">Nome</Label>
              <Input value={formNome} onChange={e => setFormNome(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Cultura</Label>
              <Select value={formCultura} onValueChange={setFormCultura}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {CULTURA_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Cor</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TALHAO_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${formColor === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Área</span>
              <span className="font-mono font-semibold">
                {computedArea != null ? `${computedArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha` : '—'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t px-2 py-2 flex items-center gap-1.5">
            <Button size="sm" onClick={handleSaveProperties} disabled={saving} className="flex-1 h-7 text-xs">
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={handleStartEditShape} className="h-7 px-2" title="Editar polígono">
              <Move className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleDelete} disabled={saving} className="h-7 px-2 text-destructive hover:text-destructive" title="Excluir">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
