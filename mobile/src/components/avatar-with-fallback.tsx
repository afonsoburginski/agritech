import React, { useState, useCallback, useEffect } from 'react';
import { Image, View, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { User } from 'lucide-react-native';
import { useColor } from '@/hooks/useColor';

const DEFAULT_AVATAR_SIZE = 44;

export type AvatarWithFallbackProps = {
  /** URI da foto (remota ou local). Se vazio, exibe fallback (ícone de usuário). */
  avatarUri?: string | null;
  size?: number;
  style?: ViewStyle;
};

/**
 * Avatar do usuário. Exibe fallback imediatamente; quando há URI, mostra a imagem assim que carregar (evita tela em branco).
 */
export function AvatarWithFallback({ avatarUri, size = DEFAULT_AVATAR_SIZE, style }: AvatarWithFallbackProps) {
  const [loaded, setLoaded] = useState(false);
  const borderColor = useColor({}, 'border');
  const mutedColor = useColor({}, 'textMuted');
  const radius = size / 2;
  useEffect(() => {
    setLoaded(false);
  }, [avatarUri]);
  const onLoad = useCallback(() => setLoaded(true), []);
  const showImage = avatarUri && loaded;

  const fallbackView = (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: mutedColor + '30',
          borderColor: borderColor,
        },
        style,
      ]}
    >
      <Icon name={User} size={size * 0.5} color={mutedColor} />
    </View>
  );

  if (!avatarUri) return fallbackView;

  return (
    <View style={[{ width: size, height: size, borderRadius: radius }, style]}>
      {!showImage && fallbackView}
      <Image
        source={{ uri: avatarUri }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: radius,
            position: 'absolute',
            opacity: showImage ? 1 : 0,
          },
        ]}
        resizeMode="cover"
        onLoad={onLoad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {},
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
