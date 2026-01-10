/**
 * Componente de Mapa de Calor usando Leaflet + leaflet.heat
 * Cores vibrantes e realistas (azul → verde → amarelo → laranja → vermelho)
 * Localização: Região rural próxima a Sinop, Mato Grosso
 */

import { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { palette } from '@/theme/colors';
import { logger } from '@/services/logger';

interface HeatmapProps {
  style?: any;
  height?: number;
}

// Talhões da fazenda - Formatos irregulares como uma fazenda real
// Fazenda com áreas de diferentes tamanhos e formas
const TALHOES = [
  // Talhão grande no norte (área de soja)
  {
    id: 'T1',
    nome: 'Talhão A - Soja',
    color: '#C9D4A8',
    coords: [
      [-11.6415, -55.4870],
      [-11.6418, -55.4780],
      [-11.6425, -55.4775],
      [-11.6480, -55.4772],
      [-11.6485, -55.4865],
      [-11.6450, -55.4875],
    ]
  },
  // Talhão médio nordeste (milho)
  {
    id: 'T2',
    nome: 'Talhão B - Milho',
    color: '#D4CDA8',
    coords: [
      [-11.6418, -55.4780],
      [-11.6420, -55.4700],
      [-11.6475, -55.4695],
      [-11.6480, -55.4772],
      [-11.6425, -55.4775],
    ]
  },
  // Talhão leste (algodão)
  {
    id: 'T3',
    nome: 'Talhão C - Algodão',
    color: '#A8C4B8',
    coords: [
      [-11.6420, -55.4700],
      [-11.6422, -55.4640],
      [-11.6520, -55.4635],
      [-11.6525, -55.4690],
      [-11.6475, -55.4695],
    ]
  },
  // Talhão central grande (soja safrinha)
  {
    id: 'T4',
    nome: 'Talhão D - Soja',
    color: '#B8D4C4',
    coords: [
      [-11.6480, -55.4772],
      [-11.6475, -55.4695],
      [-11.6525, -55.4690],
      [-11.6560, -55.4700],
      [-11.6565, -55.4780],
      [-11.6555, -55.4785],
    ]
  },
  // Talhão oeste (milho)
  {
    id: 'T5',
    nome: 'Talhão E - Milho',
    color: '#D4B8A8',
    coords: [
      [-11.6485, -55.4865],
      [-11.6480, -55.4772],
      [-11.6555, -55.4785],
      [-11.6565, -55.4780],
      [-11.6570, -55.4850],
      [-11.6540, -55.4862],
    ]
  },
  // Talhão sul grande (soja)
  {
    id: 'T6',
    nome: 'Talhão F - Soja',
    color: '#C4D4B8',
    coords: [
      [-11.6560, -55.4700],
      [-11.6520, -55.4635],
      [-11.6525, -55.4580],
      [-11.6600, -55.4575],
      [-11.6605, -55.4680],
    ]
  },
  // Talhão sudoeste (reserva/pasto)
  {
    id: 'T7',
    nome: 'Talhão G - Pasto',
    color: '#A8B8C4',
    coords: [
      [-11.6565, -55.4780],
      [-11.6560, -55.4700],
      [-11.6605, -55.4680],
      [-11.6610, -55.4760],
      [-11.6590, -55.4775],
    ]
  },
];

// Dados de pragas - Distribuição realista na fazenda
// Talhões A, C, G = SAUDÁVEIS (sem pragas)
// Talhão B = infestação moderada (amarelo/laranja)
// Talhão D = foco principal (laranja, NÃO vermelho intenso)
// Talhão E = início de infestação (verde/amarelo)
// Talhão F = alguns pontos de atenção (azul/verde)
const HEATMAP_DATA = [
  // Talhão D (central) - foco principal, mas não crítico
  { lat: -11.6510, lng: -55.4740, intensity: 0.75 },
  { lat: -11.6520, lng: -55.4735, intensity: 0.70 },
  { lat: -11.6515, lng: -55.4750, intensity: 0.68 },
  { lat: -11.6525, lng: -55.4725, intensity: 0.65 },
  
  // Talhão B (nordeste) - infestação moderada
  { lat: -11.6450, lng: -55.4740, intensity: 0.55 },
  { lat: -11.6445, lng: -55.4735, intensity: 0.50 },
  { lat: -11.6455, lng: -55.4745, intensity: 0.45 },
  
  // Talhão E (oeste) - início de infestação
  { lat: -11.6520, lng: -55.4820, intensity: 0.35 },
  { lat: -11.6530, lng: -55.4815, intensity: 0.30 },
  
  // Talhão F (sul) - pontos isolados de atenção
  { lat: -11.6570, lng: -55.4650, intensity: 0.20 },
  { lat: -11.6580, lng: -55.4640, intensity: 0.15 },
  
  // Pontos de monitoramento preventivo (azul claro)
  { lat: -11.6450, lng: -55.4820, intensity: 0.08 }, // Borda Talhão A
  { lat: -11.6590, lng: -55.4740, intensity: 0.05 }, // Talhão G (pasto - saudável)
  
  // Talhões A, C e G estão SAUDÁVEIS - sem pontos de calor significativos
];

function getHeatmapHTML(data: typeof HEATMAP_DATA, talhoes: typeof TALHOES, center: { lat: number; lng: number }) {
  const heatData = JSON.stringify(data.map(d => [d.lat, d.lng, d.intensity]));
  const talhoesData = JSON.stringify(talhoes);

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
    .talhao-tooltip {
      background: rgba(45, 55, 72, 0.9);
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
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

      // Carto Voyager - visual limpo e moderno
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      // Dados dos talhões
      const talhoes = ${talhoesData};

      // Desenhar os talhões (polígonos)
      talhoes.forEach(talhao => {
        const polygon = L.polygon(talhao.coords, {
          color: '#4A5568',
          weight: 1.5,
          opacity: 0.9,
          fillColor: talhao.color,
          fillOpacity: 0.12
        }).addTo(map);

        // Tooltip com nome do talhão
        polygon.bindTooltip(talhao.nome, {
          permanent: false,
          direction: 'center',
          className: 'talhao-tooltip'
        });
      });

      // Dados do heatmap
      const heatData = ${heatData};

      // Criar heatmap layer com gradiente vibrante e realista
      // Cores: azul (baixo) → verde → amarelo → laranja → vermelho (alto)
      const heat = L.heatLayer(heatData, {
        radius: 60,
        blur: 40,
        maxZoom: 17,
        max: 1.0,
        minOpacity: 0.7,
        gradient: {
          0.0: 'rgba(0, 0, 255, 0.8)',      // Azul puro (baixa intensidade) - MAIS VISÍVEL
          0.1: 'rgba(0, 100, 255, 0.75)',  // Azul médio
          0.2: 'rgba(0, 150, 255, 0.7)',   // Azul claro
          0.35: 'rgba(0, 255, 150, 0.75)', // Verde-azulado
          0.5: 'rgba(0, 255, 0, 0.8)',     // Verde puro
          0.65: 'rgba(255, 255, 0, 0.85)', // Amarelo puro
          0.8: 'rgba(255, 165, 0, 0.9)',   // Laranja
          0.92: 'rgba(255, 69, 0, 0.95)',  // Vermelho-laranja
          1.0: 'rgba(255, 0, 0, 1.0)'      // Vermelho puro (alta intensidade)
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

export function Heatmap({ style, height = 300 }: HeatmapProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardColor = useColor({}, 'card');
  const mutedColor = useColor({}, 'textMuted');

  const center = {
    lat: HEATMAP_DATA.reduce((sum, p) => sum + p.lat, 0) / HEATMAP_DATA.length,
    lng: HEATMAP_DATA.reduce((sum, p) => sum + p.lng, 0) / HEATMAP_DATA.length
  };

  useEffect(() => {
    logger.info('Heatmap inicializado', { points: HEATMAP_DATA.length, center });
  }, []);

  const htmlContent = getHeatmapHTML(HEATMAP_DATA, TALHOES, center);

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
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: cardColor }]}>
            <ActivityIndicator size="large" color={palette.gold} />
            <Text style={[styles.loadingText, { color: mutedColor }]}>
              Carregando mapa de calor...
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
            style={[styles.webview, { opacity: loading ? 0 : 1 }]}
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
