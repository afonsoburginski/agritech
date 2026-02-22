/**
 * Imagem com pan (arrastar) via PanResponder puro do React Native.
 * Compatível com Expo Go, simulador e dispositivo real (iOS/Android).
 */

import React, { useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View, ViewStyle } from 'react-native';

interface ZoomableImageProps {
  uri: string;
  containerStyle?: ViewStyle;
  imageWidth: number;
  imageHeight: number;
}

export function ZoomableImage({ uri, containerStyle, imageWidth, imageHeight }: ZoomableImageProps) {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value ?? 0, y: (pan.y as any)._value ?? 0 });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  return (
    <View style={[styles.container, containerStyle]} collapsable={false}>
      <Animated.View
        style={[
          styles.imageWrap,
          { width: imageWidth, height: imageHeight },
          { transform: pan.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        <Image
          source={{ uri }}
          style={[styles.image, { width: imageWidth, height: imageHeight }]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    backgroundColor: '#1a1a1a',
  },
});
