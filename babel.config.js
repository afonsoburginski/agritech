module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@/assets': './assets',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg'],
        },
      ],
      // Plugin do reanimated comentado temporariamente para Expo Go
      // Descomente quando usar development build
      // 'react-native-reanimated/plugin', // Deve ser o ÚLTIMO plugin
    ],
  };
};

