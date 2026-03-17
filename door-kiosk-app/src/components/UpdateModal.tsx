import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { useAppUpdate } from '../hooks/useAppUpdate'

const { width } = Dimensions.get('window')

export function UpdateModal() {
  const { updateInfo, downloading, progress, error, startUpdate, dismiss, showModal } = useAppUpdate()

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
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔄</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            Nueva versión disponible
          </Text>

          {/* Version */}
          <Text style={styles.version}>
            Versión {updateInfo.version}
            {updateInfo.apkSize ? ` · ${formatSize(updateInfo.apkSize)}` : ''}
          </Text>

          {/* Changelog */}
          {updateInfo.changelog ? (
            <View style={styles.changelogBox}>
              <Text style={styles.changelogLabel}>
                Novedades:
              </Text>
              <Text style={styles.changelogText}>
                {updateInfo.changelog}
              </Text>
            </View>
          ) : null}

          {/* Progress bar */}
          {downloading && (
            <View style={styles.progressSection}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>
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
                  <Text style={styles.laterButtonText}>
                    Después
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Mandatory badge */}
          {updateInfo.mandatory && (
            <Text style={styles.mandatoryText}>
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
    backgroundColor: '#ffffff',
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
    color: '#1c1917',
    marginBottom: 4,
    textAlign: 'center',
  },
  version: {
    fontSize: 14,
    color: '#78716c',
    marginBottom: 16,
  },
  changelogBox: {
    width: '100%',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    backgroundColor: '#f5f5f4',
  },
  changelogLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716c',
    marginBottom: 4,
  },
  changelogText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1c1917',
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
    backgroundColor: '#f5f5f4',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#eb5b0c',
  },
  progressText: {
    fontSize: 13,
    textAlign: 'center',
    color: '#78716c',
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
    color: '#78716c',
  },
  mandatoryText: {
    fontSize: 11,
    marginTop: 12,
    fontStyle: 'italic',
    color: '#a8a29e',
  },
})
