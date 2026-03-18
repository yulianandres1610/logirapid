import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { useUpdateStore } from '../stores/update-store'
import { useThemeStore } from '../stores/theme-store'

const { width } = Dimensions.get('window')

export function UpdateModal() {
  const { updateInfo, downloading, progress, error, startUpdate, dismiss, showModal } = useUpdateStore()
  const { colors } = useThemeStore()

  if (!showModal || !updateInfo) return null

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return ''
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="fade"
      onRequestClose={updateInfo.mandatory ? undefined : dismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔄</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            Nueva versión disponible
          </Text>

          {/* Version */}
          <Text style={[styles.version, { color: colors.textSecondary }]}>
            Versión {updateInfo.version}
            {updateInfo.apkSize ? ` · ${formatSize(updateInfo.apkSize)}` : ''}
          </Text>

          {/* Changelog */}
          {updateInfo.changelog ? (
            <View style={[styles.changelogBox, { backgroundColor: colors.bg }]}>
              <Text style={[styles.changelogLabel, { color: colors.textSecondary }]}>
                Novedades:
              </Text>
              <Text style={[styles.changelogText, { color: colors.text }]}>
                {updateInfo.changelog}
              </Text>
            </View>
          ) : null}

          {/* Progress bar */}
          {downloading && (
            <View style={styles.progressSection}>
              <View style={[styles.progressTrack, { backgroundColor: colors.bg }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress}%`, backgroundColor: '#eb5b0c' },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {progress < 100 ? `Descargando... ${progress}%` : 'Instalando...'}
              </Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Buttons */}
          {!downloading && (
            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={startUpdate}
                activeOpacity={0.8}
              >
                <Text style={styles.updateButtonText}>
                  {error ? 'Reintentar' : 'Actualizar Ahora'}
                </Text>
              </TouchableOpacity>

              {!updateInfo.mandatory && (
                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={dismiss}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.laterButtonText, { color: colors.textSecondary }]}>
                    Después
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Mandatory badge */}
          {updateInfo.mandatory && (
            <Text style={[styles.mandatoryText, { color: colors.textMuted }]}>
              Esta actualización es obligatoria
            </Text>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: width - 48,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(235, 91, 12, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  version: {
    fontSize: 14,
    marginBottom: 16,
  },
  changelogBox: {
    width: '100%',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  changelogLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  changelogText: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressSection: {
    width: '100%',
    marginBottom: 16,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  buttons: {
    width: '100%',
    gap: 10,
  },
  updateButton: {
    backgroundColor: '#eb5b0c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  mandatoryText: {
    fontSize: 11,
    marginTop: 12,
    fontStyle: 'italic',
  },
})
