import React, { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { useAuthStore } from '@/src/stores/auth-store'
import { useWarehouseStore } from '@/src/stores/warehouse-store'

const logo = require('@/src/assets/servisumic-logo.png')

export function WarehouseSelectScreen() {
  const { user, setWarehouse, logout } = useAuthStore()
  const { warehouses, fetchWarehouses, isLoading } = useWarehouseStore()

  useEffect(() => {
    fetchWarehouses()
  }, [])

  return (
    <View className="flex-1 bg-dark-800">
      {/* Header */}
      <View className="px-6 pt-10 pb-6 items-center">
        <Image source={logo} className="w-40 h-10 mb-4" resizeMode="contain" />
        <Text className="text-2xl font-bold text-white">Selecciona tu Almacén</Text>
        <Text className="text-dark-300 text-sm mt-1">{user?.email}</Text>
      </View>

      {/* Content */}
      <View className="flex-1 bg-dark-50 rounded-t-3xl">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#eb5b0c" />
            <Text className="text-dark-400 mt-4 text-sm">Cargando almacenes...</Text>
          </View>
        ) : warehouses.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-20 h-20 bg-dark-100 rounded-3xl items-center justify-center mb-4">
              <Text className="text-4xl">🏭</Text>
            </View>
            <Text className="text-lg font-bold text-dark-700 text-center">Sin almacenes</Text>
            <Text className="text-sm text-dark-400 text-center mt-1">
              No hay almacenes disponibles para tu cuenta
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
            <Text className="text-xs font-semibold text-dark-400 uppercase tracking-widest mb-4 px-1">
              Almacenes disponibles
            </Text>
            {warehouses.map((w, index) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => setWarehouse(w.id, w.name)}
                activeOpacity={0.7}
                className="mb-3"
              >
                <View
                  className="bg-white rounded-2xl p-5 flex-row items-center border border-dark-100"
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
                >
                  <View className="w-14 h-14 bg-brand-50 rounded-2xl items-center justify-center mr-4">
                    <Text className="text-3xl">🏭</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-dark-800">{w.name}</Text>
                    {w.location && (
                      <Text className="text-sm text-dark-400 mt-0.5">{w.location}</Text>
                    )}
                  </View>
                  <View className="w-10 h-10 bg-brand-50 rounded-xl items-center justify-center">
                    <Text className="text-brand-500 text-lg font-bold">›</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Logout */}
        <View className="px-6 py-5">
          <TouchableOpacity
            onPress={logout}
            className="py-3.5 items-center rounded-2xl border border-dark-200"
            activeOpacity={0.7}
          >
            <Text className="text-dark-500 font-semibold text-sm">Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
