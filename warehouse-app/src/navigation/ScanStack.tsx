import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { ScanStackParamList } from './types'
import { StockInquiryScreen } from '@/src/screens/scan/StockInquiryScreen'
import { ProductMovementsScreen } from '@/src/screens/scan/ProductMovementsScreen'
import { PrintLabelScreen } from '@/src/screens/scan/PrintLabelScreen'
import { useThemeStore } from '@/src/stores/theme-store'

const Stack = createNativeStackNavigator<ScanStackParamList>()

export function ScanStack() {
  const { colors } = useThemeStore()

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: '#eb5b0c',
        headerTitleStyle: { fontWeight: '800', color: colors.text, fontSize: 18 },
        headerBackTitle: 'Atrás',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="StockInquiry" component={StockInquiryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductMovements" component={ProductMovementsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PrintLabel" component={PrintLabelScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}
