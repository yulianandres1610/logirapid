import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { HomeStackParamList } from './types'
import { DashboardScreen } from '@/src/screens/home/DashboardScreen'
import { ReportListScreen } from '@/src/screens/reports/ReportListScreen'
import { ReportDetailScreen } from '@/src/screens/reports/ReportDetailScreen'
import { useThemeStore } from '@/src/stores/theme-store'

const Stack = createNativeStackNavigator<HomeStackParamList>()

export function HomeStack() {
  const { colors } = useThemeStore()

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReportList"
        component={ReportListScreen}
        options={{
          headerTitle: 'Reportes de Auditoría',
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontWeight: '800', color: colors.text, fontSize: 18 },
          headerTintColor: '#eb5b0c',
        }}
      />
      <Stack.Screen
        name="ReportDetail"
        component={ReportDetailScreen}
        options={{
          headerTitle: 'Detalle del Conteo',
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontWeight: '800', color: colors.text, fontSize: 18 },
          headerTintColor: '#eb5b0c',
        }}
      />
    </Stack.Navigator>
  )
}
