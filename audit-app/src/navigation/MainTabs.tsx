import React from 'react'
import { View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import type { MainTabParamList } from './types'
import { HomeStack } from './HomeStack'
import { ProductCountScreen } from '@/src/screens/counting/ProductCountScreen'
import { AssetCountScreen } from '@/src/screens/counting/AssetCountScreen'
import { SettingsScreen } from '@/src/screens/settings/SettingsScreen'
import { useThemeStore } from '@/src/stores/theme-store'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const Tab = createBottomTabNavigator<MainTabParamList>()

const TABS_META: Record<string, { icon: string }> = {
  Inicio: { icon: '🏠' },
  Productos: { icon: '📦' },
  Activos: { icon: '🏷️' },
  Config: { icon: '⚙️' },
}

const TAB_COUNT = 4
const PILL_WIDTH = 48
const DOT_SIZE = 5

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { isDark } = useThemeStore()
  const indicatorLeft = useSharedValue(0)
  const activeIndex = state.index

  React.useEffect(() => {
    const tabWidth = SCREEN_WIDTH / TAB_COUNT
    indicatorLeft.value = withSpring(activeIndex * tabWidth + (tabWidth - PILL_WIDTH) / 2, {
      damping: 18,
      stiffness: 180,
      mass: 0.6,
    })
  }, [activeIndex])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorLeft.value }],
  }))

  return (
    <View
      style={{
        backgroundColor: isDark ? '#0c0a09' : '#ffffff',
        borderTopWidth: isDark ? 0 : 1,
        borderTopColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)',
        paddingBottom: Platform.OS === 'ios' ? 24 : 10,
        paddingTop: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: isDark ? 0 : 0.05,
        shadowRadius: 12,
        elevation: isDark ? 0 : 10,
      }}
    >
      {/* Animated top line indicator */}
      <Animated.View
        style={[
          indicatorStyle,
          {
            position: 'absolute',
            top: 0,
            width: PILL_WIDTH,
            height: 3,
            backgroundColor: '#eb5b0c',
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
          },
        ]}
      />

      <View style={{ flexDirection: 'row' }}>
        {state.routes.map((route: any, i: number) => {
          const isActive = i === activeIndex
          const meta = TABS_META[route.name] || { icon: '?' }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
            >
              <Animated.View
                style={[
                  {
                    width: 50,
                    height: 50,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  isActive && {
                    backgroundColor: isDark ? 'rgba(235,91,12,0.15)' : 'rgba(235,91,12,0.1)',
                  },
                ]}
              >
                <Text style={{ fontSize: 24 }}>{meta.icon}</Text>
              </Animated.View>
              {/* Dot indicator */}
              <View
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: DOT_SIZE / 2,
                  backgroundColor: isActive ? '#eb5b0c' : 'transparent',
                  marginTop: 3,
                }}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export function MainTabs() {
  const { colors } = useThemeStore()

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name="Inicio" component={HomeStack} />
      <Tab.Screen name="Productos" component={ProductCountScreen} />
      <Tab.Screen name="Activos" component={AssetCountScreen} />
      <Tab.Screen
        name="Config"
        component={SettingsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Configuración',
          headerStyle: { backgroundColor: colors.card, elevation: 0, shadowOpacity: 0 },
          headerTitleStyle: { fontWeight: '800', color: colors.text, fontSize: 18 },
        }}
      />
    </Tab.Navigator>
  )
}
