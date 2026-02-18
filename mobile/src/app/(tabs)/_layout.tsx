import * as React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, palette } from '@/theme/colors';
import { LayoutDashboard, ClipboardList, Bug, Camera, FileText } from 'lucide-react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const activeColor = palette.gold;
  const inactiveColor = isDark ? '#6B6B6B' : '#8B8B8B';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#0A0A0A' : '#FFFDF8',  // Branco quente no light
          borderTopColor: isDark ? '#1F1F1F' : '#E0DCD3',   // Borda bege
          borderTopWidth: 1,
          height: 70,
          paddingTop: 4,
          paddingBottom: 26,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
      initialRouteName="index">
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Início',
          href: null, // Mesmo conteúdo que index; oculto da tab bar
        }}
      />
      <Tabs.Screen
        name="atividades"
        options={{
          title: 'Tarefas',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
          href: null, // Oculto da tab bar (acesso via Início > Nova tarefa)
        }}
      />
      <Tabs.Screen
        name="monitoramento"
        options={{
          title: 'Monitoramento',
          tabBarIcon: ({ color, size }) => <Bug size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reconhecimento"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => <Camera size={size} color={color} />,
          href: null, // Oculto da tab bar (acesso via Início > Escanear)
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatórios',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      {/* Perfil oculto da tab bar, acessível via avatar no header */}
      <Tabs.Screen
        name="perfil"
        options={{
          href: null, // Oculta da tab bar
        }}
      />
    </Tabs>
  );
}
