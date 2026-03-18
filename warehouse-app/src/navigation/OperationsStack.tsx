import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { OperationsStackParamList } from './types'
import { OperationsMenuScreen } from '@/src/screens/operations/OperationsMenuScreen'
import { TransferCreateScreen } from '@/src/screens/operations/TransferCreateScreen'
import { TransferValidateScreen } from '@/src/screens/operations/TransferValidateScreen'
import { ReceptionListScreen } from '@/src/screens/operations/ReceptionListScreen'
import { ReceptionDetailScreen } from '@/src/screens/operations/ReceptionDetailScreen'
import { WholesaleListScreen } from '@/src/screens/operations/WholesaleListScreen'
import { WholesaleDetailScreen } from '@/src/screens/operations/WholesaleDetailScreen'
import { ScrapAdjustmentScreen } from '@/src/screens/operations/ScrapAdjustmentScreen'
import { useThemeStore } from '@/src/stores/theme-store'

const Stack = createNativeStackNavigator<OperationsStackParamList>()

export function OperationsStack() {
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
      <Stack.Screen
        name="OperationsMenu"
        component={OperationsMenuScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="TransferCreate" component={TransferCreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TransferValidate" component={TransferValidateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ReceptionList" component={ReceptionListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ReceptionDetail" component={ReceptionDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WholesaleList" component={WholesaleListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WholesaleDetail" component={WholesaleDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ScrapAdjustment" component={ScrapAdjustmentScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}
