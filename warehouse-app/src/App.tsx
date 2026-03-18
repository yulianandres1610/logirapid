import React, { useEffect } from 'react'
import { StatusBar, ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { RootNavigator } from './navigation'
import { useAuthStore } from './stores/auth-store'
import { useThemeStore } from './stores/theme-store'
import { useUpdateStore } from './stores/update-store'
import { UpdateModal } from './components/UpdateModal'

function AppContent() {
  const initAuth = useAuthStore((s) => s.init)
  const initTheme = useThemeStore((s) => s.init)
  const initUpdate = useUpdateStore((s) => s.init)
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { isDark, colors } = useThemeStore()

  useEffect(() => {
    initAuth()
    initTheme()
    initUpdate()
  }, [])

  if (isLoading && !isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#eb5b0c" />
      </View>
    )
  }

  return <RootNavigator />
}

export default function App() {
  const { isDark, colors } = useThemeStore()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={colors.statusBar}
          />
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
          <UpdateModal />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
