/**
 * HeatmapCapture - Captura offscreen do mapa de calor Leaflet como imagem base64.
 *
 * Renderiza um WebView invisível em landscape (1280x720), carrega os tiles + heat layer,
 * usa html2canvas para gerar um screenshot em JPEG, e devolve via callback.
 * Utilizado para embutir a imagem real do heatmap no relatório PDF.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSupabaseHeatmap, useSupabaseTalhoesForMap } from '@/hooks/use-supabase-data';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { computeCenter, spreadPointsInsideTalhoes } from './heatmap';
import { logger } from '@/services/logger';

const CAPTURE_W = 1280;
const CAPTURE_H = 720;
const CAPTURE_TIMEOUT_MS = 25_000;

const ESRI_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

interface HeatmapCaptureProps {
  onCapture: (base64DataUrl: string) => void;
  onError?: (error: string) => void;
}

function getCaptureHTML(
  data: { lat: number; lng: number; intensity: number }[],
  talhoes: { nome: string; color?: string; coords: number[][] }[],
  center: { lat: number; lng: number },
): string {
  const heatData = JSON.stringify(data.map((d) => [d.lat, d.lng, d.intensity]));
  const talhoesData = JSON.stringify(talhoes);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${CAPTURE_W}">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: ${CAPTURE_W}px; height: ${CAPTURE_H}px; overflow: hidden; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
    .talhao-label {
      background: rgba(0,0,0,0.55) !important;
      border: 1px solid rgba(255,255,255,0.5) !important;
      color: #fff !important;
      font-size: 13px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      white-space: nowrap;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }
    .talhao-label::before { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"><\/script>
  <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"><\/script>
  <script>
    var captured = false;
    function doCapture() {
      if (captured) return;
      captured = true;
      setTimeout(function() {
        html2canvas(document.getElementById('map'), {
          useCORS: true,
          allowTaint: false,
          width: ${CAPTURE_W},
          height: ${CAPTURE_H},
          scale: 1.5
        }).then(function(canvas) {
          var data = canvas.toDataURL('image/jpeg', 0.90);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'capture', data: data }));
        }).catch(function(err) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: err.toString() }));
        });
      }, 1200);
    }

    try {
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false
      }).setView([${center.lat}, ${center.lng}], 14);

      var tileLayer = L.tileLayer('${ESRI_TILE}', {
        maxZoom: 19,
        crossOrigin: 'anonymous'
      }).addTo(map);

      var talhoes = ${talhoesData};
      var allBounds = [];

      talhoes.forEach(function(t) {
        var poly = L.polygon(t.coords, {
          color: 'rgba(255,255,255,0.7)',
          weight: 2.5,
          opacity: 0.9,
          fillColor: t.color || '#e5e7eb',
          fillOpacity: 0.10,
          dashArray: '6,4'
        }).addTo(map);

        allBounds = allBounds.concat(t.coords);

        var center = poly.getBounds().getCenter();
        L.tooltip({
          permanent: true,
          direction: 'center',
          className: 'talhao-label',
          offset: [0, 0],
          opacity: 1
        }).setLatLng(center).setContent(t.nome).addTo(map);
      });

      var heatData = ${heatData};
      L.heatLayer(heatData, {
        radius: 65,
        blur: 50,
        maxZoom: 18,
        max: 1.0,
        minOpacity: 0.7,
        gradient: {
          0.0:  'rgba(0, 0, 255, 0.8)',
          0.08: 'rgba(0, 80, 255, 0.75)',
          0.18: 'rgba(0, 180, 255, 0.72)',
          0.32: 'rgba(0, 255, 180, 0.75)',
          0.48: 'rgba(0, 255, 0, 0.8)',
          0.62: 'rgba(200, 255, 0, 0.82)',
          0.75: 'rgba(255, 200, 0, 0.85)',
          0.86: 'rgba(255, 120, 0, 0.9)',
          0.94: 'rgba(255, 50, 0, 0.95)',
          1.0:  'rgba(255, 0, 0, 1.0)'
        }
      }).addTo(map);

      if (allBounds.length > 0) {
        map.fitBounds(allBounds, { padding: [40, 40], animate: false });
      } else if (heatData.length > 0) {
        map.fitBounds(heatData.map(function(d) { return [d[0], d[1]]; }), { padding: [40, 40], animate: false });
      }

      tileLayer.on('load', function() {
        setTimeout(doCapture, 800);
      });

      setTimeout(doCapture, 10000);

    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: err.toString() }));
    }
  <\/script>
</body>
</html>`;
}

export function HeatmapCapture({ onCapture, onError }: HeatmapCaptureProps) {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : undefined;
  const { points, isLoading: loadingHeat } = useSupabaseHeatmap(fazendaId);
  const { talhoes, isLoading: loadingTalhoes } = useSupabaseTalhoesForMap(fazendaId);
  const capturedRef = useRef(false);

  const heatData = useMemo(
    () => spreadPointsInsideTalhoes(points, talhoes),
    [points, talhoes],
  );
  const center = useMemo(
    () => computeCenter(heatData, talhoes),
    [heatData, talhoes],
  );

  const dataReady = !loadingHeat && !loadingTalhoes;

  const html = useMemo(
    () => (dataReady ? getCaptureHTML(heatData, talhoes, center) : ''),
    [heatData, talhoes, center, dataReady],
  );

  useEffect(() => {
    if (!dataReady || capturedRef.current) return;
    const timer = setTimeout(() => {
      if (!capturedRef.current) {
        capturedRef.current = true;
        logger.warn('HeatmapCapture timeout');
        onError?.('Timeout ao capturar heatmap');
      }
    }, CAPTURE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [dataReady, onError]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (capturedRef.current) return;
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'capture' && msg.data) {
          capturedRef.current = true;
          logger.info('HeatmapCapture concluído', { bytes: msg.data.length });
          onCapture(msg.data);
        } else if (msg.type === 'error') {
          capturedRef.current = true;
          logger.error('HeatmapCapture erro interno', { message: msg.message });
          onError?.(msg.message ?? 'Erro desconhecido na captura');
        }
      } catch {
        // mensagem não-JSON ignorada
      }
    },
    [onCapture, onError],
  );

  if (Platform.OS === 'web' || !dataReady || !html) return null;

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <WebView
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        cacheEnabled={false}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CAPTURE_W,
    height: CAPTURE_H,
    opacity: 0,
    zIndex: -1,
    overflow: 'hidden',
  },
  webview: {
    width: CAPTURE_W,
    height: CAPTURE_H,
  },
});
