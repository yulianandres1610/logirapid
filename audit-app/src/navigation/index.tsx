import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { RootStackParamList } from './types'
import { useAuthStore } from '@/src/stores/auth-store'
import { AuthStack } from './AuthStack'
import { MainTabs } from './MainTabs'
import { WarehouseSelectScreen } from '@/src/screens/auth/WarehouseSelectScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const warehouseId = useAuthStore((s) => s.warehouseId)

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : !warehouseId ? (
        <Stack.Screen name="WarehouseSelect" component={WarehouseSelectScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  )
}
