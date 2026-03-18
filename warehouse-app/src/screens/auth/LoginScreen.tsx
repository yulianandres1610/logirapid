import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, Image, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useAuthStore } from '@/src/stores/auth-store'
import { getCurrentVersion } from '@/src/services/app-updater'

const logo = require('@/src/assets/servisumic-logo.png')

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const passwordRef = useRef<TextInput>(null)
  const { version } = getCurrentVersion()

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading

  const handleLogin = async () => {
    if (!canSubmit) return
    try {
      await login(email.trim(), password)
    } catch {}
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#ffffff' }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Image
            source={logo}
            style={{ width: 320, height: 100 }}
            resizeMode="contain"
          />
        </View>

        {/* Error */}
        {error ? (
          <View style={{
            backgroundColor: '#fef2f2', borderRadius: 12, padding: 12,
            flexDirection: 'row', alignItems: 'center', marginBottom: 20,
            borderWidth: 1, borderColor: '#fecaca',
          }}>
            <View style={{
              width: 28, height: 28, borderRadius: 14, backgroundColor: '#fee2e2',
              alignItems: 'center', justifyContent: 'center', marginRight: 10,
            }}>
              <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>!</Text>
            </View>
            <Text style={{ color: '#b91c1c', fontSize: 13, fontWeight: '500', flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        {/* Email */}
        <View style={{
          backgroundColor: '#fafaf9', borderRadius: 14, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', marginBottom: 12,
          borderWidth: 1.5, borderColor: focused === 'email' ? '#eb5b0c' : '#e7e5e4',
        }}>
          <Text style={{ color: '#a8a29e', fontSize: 18, marginRight: 10 }}>@</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#a8a29e"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            onSubmitEditing={() => passwordRef.current?.focus()}
            style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: '#1c1917', fontWeight: '500' }}
          />
        </View>

        {/* Password */}
        <View style={{
          backgroundColor: '#fafaf9', borderRadius: 14, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', marginBottom: 20,
          borderWidth: 1.5, borderColor: focused === 'password' ? '#eb5b0c' : '#e7e5e4',
        }}>
          <Text style={{ color: '#a8a29e', fontSize: 16, marginRight: 10 }}>🔒</Text>
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            placeholderTextColor="#a8a29e"
            secureTextEntry={!showPassword}
            returnKeyType="go"
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            onSubmitEditing={handleLogin}
            style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: '#1c1917', fontWeight: '500' }}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: '#78716c', fontSize: 13, fontWeight: '600' }}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
          </TouchableOpacity>
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={!canSubmit}
          activeOpacity={0.8}
          style={{
            backgroundColor: canSubmit ? '#eb5b0c' : '#d6d3d1',
            borderRadius: 14, paddingVertical: 15, alignItems: 'center',
            shadowColor: canSubmit ? '#eb5b0c' : 'transparent',
            shadowOffset: { width: 0, height: 4 }, shadowOpacity: canSubmit ? 0.3 : 0, shadowRadius: 8, elevation: canSubmit ? 6 : 0,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: canSubmit ? '#fff' : '#a8a29e', fontSize: 16, fontWeight: '700' }}>Entrar</Text>
          )}
        </TouchableOpacity>

        {/* Watermark */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ fontSize: 11, color: '#d6d3d1', fontWeight: '500' }}>v{version}</Text>
          <Text style={{ fontSize: 10, color: '#d6d3d1', marginTop: 2 }}>Servisumic. Todos los derechos reservados.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
