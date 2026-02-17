module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
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
      // Plugin do reanimated comentado para Expo Go
      // Descomente apenas se usar development build
      // 'react-native-reanimated/plugin', // Deve ser o ÚLTIMO plugin
    ],
  };
};

