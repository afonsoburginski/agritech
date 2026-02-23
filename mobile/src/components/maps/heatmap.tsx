/**
 * Componente de Mapa de Calor: Leaflet + leaflet.heat (manchas) e tiles Google/OSM
 * Cores vibrantes e realistas (azul → verde → amarelo → laranja → vermelho)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSupabaseHeatmap, useSupabaseTalhoesForMap, useSupabasePontosMonitoramento } from '@/hooks/use-supabase-data';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { palette } from '@/theme/colors';
import { logger } from '@/services/logger';

export type HeatmapMapType = 'satellite' | 'street';

interface HeatmapProps {
  style?: any;
  height?: number;
  /** 'satellite' = Google Satellite, 'street' = CartoDB Dark Matter (igual Google Maps dark do web) */
  mapType?: HeatmapMapType;
}

/** Centro do mapa: centróide dos pontos ou do primeiro polígono, ou fallback fixo */
export function computeCenter(
  points: { lat: number; lng: number }[],
  talhoes: { coords: number[][] }[]
): { lat: number; lng: number } {
  if (points.length > 0) {
    return {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
    };
  }
  if (talhoes.length > 0 && talhoes[0].coords.length > 0) {
    const c = talhoes[0].coords;
    const sumLat = c.reduce((s, p) => s + p[0], 0);
    const sumLng = c.reduce((s, p) => s + p[1], 0);
    return { lat: sumLat / c.length, lng: sumLng / c.length };
  }
  return { lat: -11.652, lng: -55.472 };
}

/** Bounds para projeção lat/lng → SVG. Com dados vazios retorna região padrão (Sinop, MT). */
function getBounds(
  data: { lat: number; lng: number }[],
  talhoes: { coords: number[][] }[]
) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of data) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  for (const t of talhoes) {
    for (const c of t.coords) {
      const [lat, lng] = c;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
  }
  if (minLat === Infinity || data.length === 0 && talhoes.length === 0) {
    const pad = 0.01;
    return {
      minLat: -11.66 - pad,
      maxLat: -11.64 + pad,
      minLng: -55.49 - pad,
      maxLng: -55.45 + pad,
    };
  }
  const pad = 0.002;
  return {
    minLat: minLat - pad,
    maxLat: maxLat + pad,
    minLng: minLng - pad,
    maxLng: maxLng + pad,
  };
}

/** Mesmo gradiente do Leaflet heat: população baixa (azul) → alta (vermelho), transições suaves */
const HEAT_GRADIENT_STOPS: [number, number[]][] = [
  [0, [0, 0, 255]],
  [0.08, [0, 80, 255]],
  [0.18, [0, 180, 255]],
  [0.32, [0, 255, 180]],
  [0.48, [0, 255, 0]],
  [0.62, [200, 255, 0]],
  [0.75, [255, 200, 0]],
  [0.86, [255, 120, 0]],
  [0.94, [255, 50, 0]],
  [1.0, [255, 0, 0]],
];

function interpolateGradient(intensity: number): [number, number, number] {
  const i = Math.max(0, Math.min(1, intensity));
  const maxIdx = HEAT_GRADIENT_STOPS.length - 1;
  let idx = 0;
  while (idx < maxIdx - 1 && HEAT_GRADIENT_STOPS[idx + 1][0] <= i) idx++;
  // Clamp so idx+1 is always valid
  const clampedIdx = Math.min(idx, maxIdx - 1);
  const stop0 = HEAT_GRADIENT_STOPS[clampedIdx];
  const stop1 = HEAT_GRADIENT_STOPS[clampedIdx + 1];
  const t0 = stop0[0]; const rgb0 = stop0[1];
  const t1 = stop1[0]; const rgb1 = stop1[1];
  const span = t1 - t0;
  const t = span === 0 ? 0 : (i - t0) / span;
  const r = Math.round(rgb0[0] + t * (rgb1[0] - rgb0[0]));
  const g = Math.round(rgb0[1] + t * (rgb1[1] - rgb0[1]));
  const b = Math.round(rgb0[2] + t * (rgb1[2] - rgb0[2]));
  return [r, g, b];
}

function intensityToHex(intensity: number): string {
  const [r, g, b] = interpolateGradient(intensity);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Mesma escala do heat em rgba com transparência (para badge do talhão). */
function intensityToRgba(intensity: number, alpha: number): string {
  const [r, g, b] = interpolateGradient(intensity);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Point-in-polygon (ray-casting). coords: array de [lat, lng]. */
function pointInPolygon(lat: number, lng: number, coords: number[][]): boolean {
  const n = coords.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [latI, lngI] = [coords[i][0], coords[i][1]];
    const [latJ, lngJ] = [coords[j][0], coords[j][1]];
    if (((lngI > lng) !== (lngJ > lng)) && (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI)) inside = !inside;
  }
  return inside;
}

/** Centróide do polígono. coords: array de [lat, lng]. */
function polygonCentroid(coords: number[][]): { lat: number; lng: number } {
  if (!coords.length) return { lat: 0, lng: 0 };
  const sumLat = coords.reduce((s, c) => s + c[0], 0);
  const sumLng = coords.reduce((s, c) => s + c[1], 0);
  return { lat: sumLat / coords.length, lng: sumLng / coords.length };
}

/** Raio seguro (em graus) para manter pontos dentro do polígono (~35% do menor lado do bbox). */
function polygonSafeRadius(coords: number[][]): number {
  if (coords.length < 2) return 0.0002;
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const spanLat = Math.max(...lats) - Math.min(...lats);
  const spanLng = Math.max(...lngs) - Math.min(...lngs);
  return Math.min(spanLat, spanLng) * 0.35;
}

/**
 * Espalha todos os pontos dentro do layer do talhão respectivo.
 * Agrupa por talhaoId e coloca cada ponto em posições distintas em círculo no interior do polígono.
 */
export function spreadPointsInsideTalhoes(
  points: { lat: number; lng: number; intensity: number; pragaNome?: string; talhaoId?: number }[],
  talhoes: { id: number; nome: string; coords: number[][] }[]
): { lat: number; lng: number; intensity: number; pragaNome?: string }[] {
  const byId: Record<number, { id: number; nome: string; coords: number[][] }> = {};
  talhoes.forEach((t) => { byId[t.id] = t; });

  const withTalhao = points.filter((p) => p.talhaoId != null);
  const withoutTalhao = points.filter((p) => p.talhaoId == null);

  const byTalhao: Record<number, typeof points> = {};
  withTalhao.forEach((p) => {
    const id = p.talhaoId!;
    if (!byTalhao[id]) byTalhao[id] = [];
    byTalhao[id].push(p);
  });

  const result: { lat: number; lng: number; intensity: number; pragaNome?: string }[] = withoutTalhao.map((p) => ({ lat: p.lat, lng: p.lng, intensity: p.intensity, pragaNome: p.pragaNome }));

  Object.keys(byTalhao).forEach((key) => {
    const talhaoId = Number(key);
    const group = byTalhao[talhaoId];
    const talhao = byId[talhaoId];
    if (!talhao || talhao.coords.length < 3) {
      group.forEach((p) => result.push({ lat: p.lat, lng: p.lng, intensity: p.intensity, pragaNome: p.pragaNome }));
      return;
    }

    const centroid = polygonCentroid(talhao.coords);
    const radius = polygonSafeRadius(talhao.coords);
    const n = group.length;

    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / n;
      const lat = centroid.lat + radius * Math.cos(angle);
      const lng = centroid.lng + radius * Math.sin(angle);
      result.push({ lat, lng, intensity: p.intensity, pragaNome: p.pragaNome });
    });
  });

  return result;
}

/** Intensidade média de incidência de pragas dentro do talhão (0 se nenhum ponto). */
function talhaoIncidenceRgba(
  talhao: { coords: number[][] },
  heatData: { lat: number; lng: number; intensity: number }[],
  alpha: number
): string {
  const inside = heatData.filter((p) => pointInPolygon(p.lat, p.lng, talhao.coords));
  if (inside.length === 0) return `rgba(45,55,72,${alpha})`;
  const avg = inside.reduce((s, p) => s + p.intensity, 0) / inside.length;
  return intensityToRgba(avg, alpha);
}

/**
 * Gera SVG estático do mapa de calor para inclusão em PDF.
 * Usa apenas dados reais passados (heatmap e talhões do banco).
 * Fiel ao componente: mesmo radius/blur, fillOpacity 0.12 nos talhões,
 * gradiente azul → verde → amarelo → laranja → vermelho, ordem por intensidade.
 */
export function getHeatmapSVG(
  data: { lat: number; lng: number; intensity: number }[] = [],
  talhoes: { color?: string; coords: number[][] }[] = [],
  width = 560,
  height = 320
): string {
  const b = getBounds(data, talhoes);
  const scaleX = (lng: number) => ((lng - b.minLng) / (b.maxLng - b.minLng)) * width;
  const scaleY = (lat: number) => height - ((lat - b.minLat) / (b.maxLat - b.minLat)) * height;

  const polygonPoints = (coords: number[][]) =>
    coords.map((c) => `${scaleX(c[1])},${scaleY(c[0])}`).join(' ');

  const polygons = talhoes
    .map((t) => {
      const fill = t.color ?? '#22c55e';
      return `<polygon points="${polygonPoints(t.coords)}" fill="${fill}" fill-opacity="0.2" stroke="${fill}" stroke-width="2.5" stroke-opacity="0.9" />`;
    })
    .join('\n');

  // Normaliza intensidades relativas ao range real (igual ao componente interativo)
  const maxI = data.length > 0 ? Math.max(...data.map((p) => p.intensity)) : 1;
  const minI = data.length > 0 ? Math.min(...data.map((p) => p.intensity)) : 0;
  const normalizeI = (i: number) => maxI === minI ? 0.5 : (i - minI) / (maxI - minI);

  // Ordenar por intensidade (menor primeiro) para desenhar por cima os pontos mais intensos, como no heat layer
  const sorted = [...data].sort((a, b) => a.intensity - b.intensity);

  // Raio/blur alinhados ao app (radius 65, blur 50)
  const radiusMin = 52;
  const radiusMax = 115;
  const circleR = (intensity: number) => radiusMin + intensity * (radiusMax - radiusMin);
  const minOpacity = 0.5;

  const circles = sorted
    .map((p) => {
      const ni = normalizeI(p.intensity);
      const x = scaleX(p.lng);
      const y = scaleY(p.lat);
      const r = circleR(ni);
      const fill = intensityToHex(ni);
      const opacity = minOpacity + ni * 0.65;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" fill-opacity="${opacity}" filter="url(#heatBlur)" />`;
    })
    .join('\n');

  // Desfoque (equivalente a blur 50): bordas suaves e transições contínuas
  const blurFilter = `<filter id="heatBlur" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="18"/>
  </filter>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="display:block;">
  <defs>${blurFilter}</defs>
  ${polygons}
  ${circles}
</svg>`;
}

type HeatmapTalhao = { nome: string; color?: string; coords: number[][] };
type HeatmapPonto = { id: number; nome: string; lat: number; lng: number };

const TILE_LAYERS = {
  satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  // dark: CartoDB Dark Matter | light: Google Maps Roadmap
  streetDark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  streetLight: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
};

/** SVG path do ícone de câmera de segurança (Phosphor PiSecurityCameraThin) */
const CAMERA_SVG_PATH =
  'M248,140a4,4,0,0,0-4,4v20H195.31a4,4,0,0,1-2.82-1.17l-21.18-21.17,53.18-53.17a12,12,0,0,0,0-17l-56-56a12,12,0,0,0-17,0L5.76,161.76A6,6,0,0,0,10,172H51l36.48,36.49a12,12,0,0,0,17,0l61.18-61.18,21.17,21.17a11.9,11.9,0,0,0,8.48,3.52H244v20a4,4,0,0,0,8,0V144A4,4,0,0,0,248,140ZM157.17,21.17a4.1,4.1,0,0,1,5.66,0l15.51,15.52L51,164H14.82ZM98.83,202.83a4.1,4.1,0,0,1-5.66,0L58.34,168,184,42.34l34.83,34.83a4,4,0,0,1,0,5.66Z';

function getHeatmapHTML(
  data: { lat: number; lng: number; intensity: number }[],
  talhoes: HeatmapTalhao[],
  center: { lat: number; lng: number },
  mapType: 'satellite' | 'street' = 'satellite',
  pontos: HeatmapPonto[] = [],
  isDark: boolean = true,
  mapBgColor: string = '#1a1a1a'
) {
  const heatData = JSON.stringify(data.map((d) => [d.lat, d.lng, d.intensity]));
  const talhoesData = JSON.stringify(talhoes.map((t) => ({
    nome: t.nome,
    color: t.color ?? '#22c55e',
    coords: t.coords,
  })));
  const pontosData = JSON.stringify(pontos);
  const tileUrl = mapType === 'satellite'
    ? TILE_LAYERS.satellite
    : (isDark ? TILE_LAYERS.streetDark : TILE_LAYERS.streetLight);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background-color: ${mapBgColor}; -webkit-tap-highlight-color: transparent; }
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }
    .leaflet-pane path.leaflet-interactive { cursor: pointer; }
    #talhao-badge {
      position: absolute;
      background: rgba(0,0,0,0.5);
      border-radius: 999px;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
      transform: translate(-50%, -50%);
      display: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="talhao-badge"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
  <script>
    try {
      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true
      }).setView([${center.lat}, ${center.lng}], 14);

      L.tileLayer('${tileUrl}', {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);

      const talhoes = ${talhoesData};

      var badge = document.getElementById('talhao-badge');
      var selectedPolygon = null;

      function showBadge(name, latlng) {
        var pt = map.latLngToContainerPoint(latlng);
        badge.textContent = name;
        badge.style.left = pt.x + 'px';
        badge.style.top = pt.y + 'px';
        badge.style.display = 'block';
      }

      function hideBadge() {
        badge.style.display = 'none';
        selectedPolygon = null;
      }

      talhoes.forEach(function(talhao) {
        var tColor = talhao.color || '#22c55e';
        var polygon = L.polygon(talhao.coords, {
          color: tColor,
          weight: 2.5,
          opacity: 0.9,
          fillColor: tColor,
          fillOpacity: 0.2
        }).addTo(map);

        polygon.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          if (selectedPolygon === polygon) {
            hideBadge();
          } else {
            selectedPolygon = polygon;
            showBadge(talhao.nome, e.latlng);
          }
        });
      });

      map.on('click', function() { hideBadge(); });
      map.on('move', function() {
        if (selectedPolygon) {
          var center = selectedPolygon.getBounds().getCenter();
          var pt = map.latLngToContainerPoint(center);
          badge.style.left = pt.x + 'px';
          badge.style.top = pt.y + 'px';
        }
      });

      var pontosArr = ${pontosData};
      var cameraSvgPath = '${CAMERA_SVG_PATH}';
      pontosArr.forEach(function(p) {
        var labelText = p.nome.length > 12 ? p.nome.slice(0, 11) + '…' : p.nome;
        var escaped = labelText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 42" width="80" height="42">'
          + '<rect x="27" y="0" width="26" height="26" rx="4" fill="rgba(107,114,128,0.4)" stroke="white" stroke-width="1"/>'
          + '<g transform="translate(30,3) scale(0.078125)" fill="white"><path d="' + cameraSvgPath + '"/></g>'
          + '<text x="40" y="38" text-anchor="middle" font-size="10" font-weight="500" fill="white" style="text-shadow:0 1px 2px rgba(0,0,0,0.5)">' + escaped + '</text>'
          + '</svg>';
        var iconUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgStr);
        var icon = L.icon({
          iconUrl: iconUrl,
          iconSize: [80, 42],
          iconAnchor: [40, 42],
          popupAnchor: [0, -42]
        });
        L.marker([p.lat, p.lng], { icon: icon, interactive: false }).addTo(map);
      });

      const heatData = ${heatData};
      var heat = L.heatLayer(heatData, {
        radius: 55,
        blur: 40,
        maxZoom: 18,
        max: 1.0,
        minOpacity: 0.5,
        gradient: {
          0.0:  'rgb(0, 0, 255)',
          0.1:  'rgb(0, 80, 255)',
          0.22: 'rgb(0, 200, 255)',
          0.36: 'rgb(0, 255, 180)',
          0.5:  'rgb(0, 255, 0)',
          0.64: 'rgb(180, 255, 0)',
          0.76: 'rgb(255, 200, 0)',
          0.87: 'rgb(255, 100, 0)',
          1.0:  'rgb(255, 0, 0)'
        }
      }).addTo(map);

      window.updateHeatData = function(newData) {
        heat.setLatLngs(newData);
      };

    } catch (error) {
      console.error('Error:', error);
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f5f5f5;color:#666;font-family:sans-serif;padding:20px;text-align:center;">Erro ao carregar o mapa</div>';
    }
  </script>
</body>
</html>
`;
}

export function Heatmap({ style, height = 300, mapType: mapTypeProp = 'satellite' }: HeatmapProps) {
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const cardColor = useColor({}, 'card');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mutedColor = useColor({}, 'textMuted');

  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : undefined;
  const { points: heatPoints, isLoading: loadingHeat, refetch: refetchHeat } = useSupabaseHeatmap(fazendaId);
  const { talhoes: talhoesFromApi, isLoading: loadingTalhoes, refetch: refetchTalhoes } = useSupabaseTalhoesForMap(fazendaId);
  const { pontos: pontosFromApi, isLoading: loadingPontos, refetch: refetchPontos } = useSupabasePontosMonitoramento(fazendaId);

  const heatData = useMemo(() => {
    const spread = spreadPointsInsideTalhoes(heatPoints, talhoesFromApi);
    if (spread.length === 0) return spread;
    // Normaliza intensidades relativas ao range real: mínimo → 0.0 (azul puro), máximo → 1.0 (vermelho)
    const maxI = Math.max(...spread.map((p) => p.intensity));
    const minI = Math.min(...spread.map((p) => p.intensity));
    if (maxI === minI) return spread.map((p) => ({ ...p, intensity: 0.5 }));
    return spread.map((p) => ({
      ...p,
      intensity: (p.intensity - minI) / (maxI - minI),
    }));
  }, [heatPoints, talhoesFromApi]);

  const talhoesData = useMemo(() => talhoesFromApi, [talhoesFromApi]);
  const center = useMemo(
    () => computeCenter(heatData, talhoesFromApi),
    [heatData, talhoesFromApi]
  );

  useFocusEffect(
    useCallback(() => {
      refetchHeat();
      refetchTalhoes();
      refetchPontos();
    }, [refetchHeat, refetchTalhoes, refetchPontos])
  );

  const dataReady = !loadingHeat && !loadingTalhoes && !loadingPontos;
  const htmlContent = useMemo(
    () => getHeatmapHTML(heatData, talhoesData, center, mapTypeProp, pontosFromApi, isDark, cardColor),
    [heatData, talhoesData, center, mapTypeProp, pontosFromApi, isDark, cardColor]
  );

  // Quando dados mudam e o mapa já está carregado, injeta os novos pontos sem recriar o WebView
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const newData = JSON.stringify(heatData.map((d) => [d.lat, d.lng, d.intensity]));
    webViewRef.current.injectJavaScript(`
      if (window.updateHeatData) {
        window.updateHeatData(${newData});
      }
      true;
    `);
    logger.info('Heatmap atualizado via realtime', { points: heatData.length });
  }, [heatData, mapReady]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height, backgroundColor: cardColor }, style]}>
        <Text style={{ color: mutedColor }}>Heatmap não disponível na web</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]} collapsable={false}>
      <View
        style={[styles.mapContainer, { height, backgroundColor: cardColor }]}
        collapsable={false}
        renderToHardwareTextureAndroid={true}
      >
        {(loading || !dataReady) && (
          <View style={[styles.loadingOverlay, { backgroundColor: cardColor }]}>
            <ActivityIndicator size="large" color={palette.gold} />
            <Text style={[styles.loadingText, { color: mutedColor }]}>
              {!dataReady ? 'Carregando dados do mapa...' : 'Carregando mapa de calor...'}
            </Text>
          </View>
        )}
        
        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: cardColor, height }]}>
            <Text style={{ color: mutedColor }}>{error}</Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={[styles.webview, { opacity: dataReady && !loading ? 1 : 0, backgroundColor: cardColor }]}
            onLoadEnd={() => {
              setTimeout(() => {
                setLoading(false);
                setMapReady(true);
              }, 600);
            }}
            onError={() => {
              setError('Erro ao carregar mapa');
              setLoading(false);
            }}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            mixedContentMode="compatibility"
            allowsInlineMediaPlayback={true}
            cacheEnabled={false}
            androidLayerType="hardware"
            nestedScrollEnabled={false}
          />
        )}
      </View>

      {/* Legenda com cores vibrantes */}
      <View style={[styles.legend, { backgroundColor: cardColor }]}>
        <View style={styles.gradientBar}>
          <View style={[styles.gradientSegment, { backgroundColor: '#0000FF' }]} />
          <View style={[styles.gradientSegment, { backgroundColor: '#0080FF' }]} />
          <View style={[styles.gradientSegment, { backgroundColor: '#00FF00' }]} />
          <View style={[styles.gradientSegment, { backgroundColor: '#80FF00' }]} />
          <View style={[styles.gradientSegment, { backgroundColor: '#FFFF00' }]} />
          <View style={[styles.gradientSegment, { backgroundColor: '#FFA500' }]} />
          <View style={[styles.gradientSegment, { backgroundColor: '#FF4500' }]} />
          <View style={[styles.gradientSegment, { backgroundColor: '#FF0000' }]} />
        </View>
        <View style={styles.legendLabels}>
          <Text style={[styles.legendText, { color: mutedColor }]}>Baixa incidência</Text>
          <Text style={[styles.legendText, { color: mutedColor }]}>Alta incidência</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  mapContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  gradientBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  gradientSegment: {
    flex: 1,
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
