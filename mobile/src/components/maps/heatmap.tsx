/**
 * Componente de Mapa de Calor usando Leaflet + leaflet.heat
 * Cores vibrantes e realistas (azul → verde → amarelo → laranja → vermelho)
 * Localização: Região rural próxima a Sinop, Mato Grosso
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { useSupabaseHeatmap, useSupabaseTalhoesForMap } from '@/hooks/use-supabase-data';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { palette } from '@/theme/colors';
import { logger } from '@/services/logger';

export type HeatmapMapType = 'satellite' | 'street';

interface HeatmapProps {
  style?: any;
  height?: number;
  /** 'satellite' = Esri World Imagery, 'street' = OpenStreetMap */
  mapType?: HeatmapMapType;
}

/** Centro do mapa: centróide dos pontos ou do primeiro polígono, ou fallback fixo */
function computeCenter(
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

function intensityToHex(intensity: number): string {
  const i = Math.max(0, Math.min(1, intensity));
  let idx = 0;
  while (idx < HEAT_GRADIENT_STOPS.length - 1 && HEAT_GRADIENT_STOPS[idx + 1][0] <= i) idx++;
  const [t0, rgb0] = HEAT_GRADIENT_STOPS[idx];
  const [t1, rgb1] = HEAT_GRADIENT_STOPS[idx + 1];
  const t = (i - t0) / (t1 - t0);
  const r = Math.round(rgb0[0] + t * (rgb1[0] - rgb0[0]));
  const g = Math.round(rgb0[1] + t * (rgb1[1] - rgb0[1]));
  const b = Math.round(rgb0[2] + t * (rgb1[2] - rgb0[2]));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Mesma escala do heat em rgba com transparência (para badge do talhão). */
function intensityToRgba(intensity: number, alpha: number): string {
  const i = Math.max(0, Math.min(1, intensity));
  let idx = 0;
  while (idx < HEAT_GRADIENT_STOPS.length - 1 && HEAT_GRADIENT_STOPS[idx + 1][0] <= i) idx++;
  const [t0, rgb0] = HEAT_GRADIENT_STOPS[idx];
  const [t1, rgb1] = HEAT_GRADIENT_STOPS[idx + 1];
  const t = (i - t0) / (t1 - t0);
  const r = Math.round(rgb0[0] + t * (rgb1[0] - rgb0[0]));
  const g = Math.round(rgb0[1] + t * (rgb1[1] - rgb0[1]));
  const b = Math.round(rgb0[2] + t * (rgb1[2] - rgb0[2]));
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

  // Talhões: borda cinza perto do preto, preenchimento discreto
  const polygons = talhoes
    .map((t) => {
      const fill = t.color ?? '#e5e7eb';
      return `<polygon points="${polygonPoints(t.coords)}" fill="${fill}" fill-opacity="0.12" stroke="#374151" stroke-width="1.5" stroke-opacity="0.9" />`;
    })
    .join('\n');

  // Ordenar por intensidade (menor primeiro) para desenhar por cima os pontos mais intensos, como no heat layer
  const sorted = [...data].sort((a, b) => a.intensity - b.intensity);

  // Raio/blur alinhados ao app (radius 65, blur 50)
  const radiusMin = 52;
  const radiusMax = 115;
  const circleR = (intensity: number) => radiusMin + intensity * (radiusMax - radiusMin);
  const minOpacity = 0.7;

  const circles = sorted
    .map((p) => {
      const x = scaleX(p.lng);
      const y = scaleY(p.lat);
      const r = circleR(p.intensity);
      const fill = intensityToHex(p.intensity);
      const opacity = minOpacity + p.intensity * 0.25;
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

const TILE_LAYERS = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

function getHeatmapHTML(
  data: { lat: number; lng: number; intensity: number }[],
  talhoes: HeatmapTalhao[],
  center: { lat: number; lng: number },
  mapType: 'satellite' | 'street' = 'satellite'
) {
  const heatData = JSON.stringify(data.map((d) => [d.lat, d.lng, d.intensity]));
  const talhoesWithIncidence = talhoes.map((t) => ({
    ...t,
    incidenceRgbaBg: talhaoIncidenceRgba(t, data, 0.22),
    incidenceRgbaBorder: talhaoIncidenceRgba(t, data, 0.5),
  }));
  const talhoesData = JSON.stringify(talhoesWithIncidence);
  const tileUrl = TILE_LAYERS[mapType];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; }
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }
    /* Pointer nos talhões (paths dos polígonos; o heat é canvas) */
    .leaflet-pane path.leaflet-interactive { cursor: pointer; }
    .talhao-tooltip {
      border-radius: 999px;
      border-width: 1px;
      border-style: solid;
      background: rgba(45,55,72,0.22) !important;
      border-color: rgba(255,255,255,0.4) !important;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      white-space: nowrap;
      text-shadow: 0 1px 2px rgba(0,0,0,0.4);
    }
    .talhao-tooltip::before { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
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

      // Base: satélite (Esri) ou rua (OSM)
      L.tileLayer('${tileUrl}', {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);

      // Dados dos talhões
      const talhoes = ${talhoesData};

      // Badge ao clicar: nome do talhão, fundo = cor da incidência (com transparência)
      var currentTooltipLayer = null;
      talhoes.forEach(talhao => {
        const polygon = L.polygon(talhao.coords, {
          color: '#374151',
          weight: 1.5,
          opacity: 0.9,
          fillColor: talhao.color,
          fillOpacity: 0.12
        }).addTo(map);

        polygon.bindTooltip(talhao.nome, {
          permanent: false,
          direction: 'center',
          className: 'talhao-tooltip',
          offset: [0, 0],
          opacity: 1,
          openDelay: 1e6
        });

        polygon.on('click', function(e) {
          if (currentTooltipLayer && currentTooltipLayer !== polygon) currentTooltipLayer.closeTooltip();
          currentTooltipLayer = polygon;
          var tip = polygon.getTooltip();
          var el = tip._container;
          el.style.background = talhao.incidenceRgbaBg || 'rgba(45,55,72,0.22)';
          el.style.borderColor = talhao.incidenceRgbaBorder || 'rgba(255,255,255,0.4)';
          el.style.borderWidth = '1px';
          el.style.borderStyle = 'solid';
          polygon.openTooltip(e.latlng);
        });
      });

      // Dados do heatmap
      const heatData = ${heatData};

      // Heatmap de população: pouca identificação = azul (baixo), muita = vermelho (alto)
      const heat = L.heatLayer(heatData, {
        radius: 65,
        blur: 50,
        maxZoom: 18,
        max: 1.0,
        minOpacity: 0.7,
        gradient: {
          0.0: 'rgba(0, 0, 255, 0.8)',
          0.08: 'rgba(0, 80, 255, 0.75)',
          0.18: 'rgba(0, 180, 255, 0.72)',
          0.32: 'rgba(0, 255, 180, 0.75)',
          0.48: 'rgba(0, 255, 0, 0.8)',
          0.62: 'rgba(200, 255, 0, 0.82)',
          0.75: 'rgba(255, 200, 0, 0.85)',
          0.86: 'rgba(255, 120, 0, 0.9)',
          0.94: 'rgba(255, 50, 0, 0.95)',
          1.0: 'rgba(255, 0, 0, 1.0)'
        }
      }).addTo(map);

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
  const [error, setError] = useState<string | null>(null);
  const cardColor = useColor({}, 'card');
  const mutedColor = useColor({}, 'textMuted');

  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : undefined;
  const { points: heatPoints, isLoading: loadingHeat, refetch: refetchHeat } = useSupabaseHeatmap(fazendaId);
  const { talhoes: talhoesFromApi, isLoading: loadingTalhoes, refetch: refetchTalhoes } = useSupabaseTalhoesForMap(fazendaId);

  const heatData = useMemo(() => heatPoints, [heatPoints]);
  const talhoesData = useMemo(() => talhoesFromApi, [talhoesFromApi]);
  const center = useMemo(
    () => computeCenter(heatPoints, talhoesFromApi),
    [heatPoints, talhoesFromApi]
  );

  useFocusEffect(
    useCallback(() => {
      refetchHeat();
      refetchTalhoes();
    }, [refetchHeat, refetchTalhoes])
  );

  const dataReady = !loadingHeat && !loadingTalhoes;
  const htmlContent = useMemo(
    () => getHeatmapHTML(heatData, talhoesData, center, mapTypeProp),
    [heatData, talhoesData, center, mapTypeProp]
  );

  useEffect(() => {
    logger.info('Heatmap inicializado', {
      points: heatData.length,
      talhoes: talhoesData.length,
      fromApi: heatPoints.length > 0 || talhoesFromApi.length > 0,
    });
  }, [heatData.length, talhoesData.length, heatPoints.length, talhoesFromApi.length]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height, backgroundColor: cardColor }, style]}>
        <Text style={{ color: mutedColor }}>Heatmap não disponível na web</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.mapContainer, { height }]}>
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
            source={{ html: htmlContent }}
            style={[styles.webview, { opacity: dataReady && !loading ? 1 : 0 }]}
            onLoadEnd={() => {
              setTimeout(() => setLoading(false), 1000);
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
            cacheEnabled={true}
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
    backgroundColor: 'transparent',
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
    padding: 12,
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
    marginTop: 8,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
