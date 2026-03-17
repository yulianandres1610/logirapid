import React, { useEffect } from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useKioskStore } from './store/kiosk-store'
import { useDataWedge } from './hooks/useDataWedge'
import { useInactivityTimeout } from './hooks/useInactivityTimeout'

import { UpdateModal } from './components/UpdateModal'
import { LoginScreen } from './screens/LoginScreen'
import { KioskSelectScreen } from './screens/KioskSelectScreen'
import { LoadingScreen } from './screens/LoadingScreen'
import { GuardPinScreen } from './screens/GuardPinScreen'
import { IdleScreen } from './screens/IdleScreen'
import { ProcessingScreen } from './screens/ProcessingScreen'
import { PurposeSelectScreen } from './screens/PurposeSelectScreen'
import { EntrySuccessScreen } from './screens/EntrySuccessScreen'
import { ExitPendingScreen } from './screens/ExitPendingScreen'
import { ExitSuccessScreen } from './screens/ExitSuccessScreen'
import { TodayLogScreen } from './screens/TodayLogScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { InsideListScreen } from './screens/InsideListScreen'
import { PrintLabelScreen } from './screens/PrintLabelScreen'

function KioskApp() {
  const step = useKioskStore(s => s.step)
  const init = useKioskStore(s => s.init)

  useDataWedge()
  useInactivityTimeout()

  useEffect(() => {
    init()
  }, [init])

  const renderScreen = () => {
    switch (step) {
      case 'login':
        return <LoginScreen />
      case 'kiosk_select':
        return <KioskSelectScreen />
      case 'loading':
        return <LoadingScreen />
      case 'guard_pin':
        return <GuardPinScreen />
      case 'idle':
      case 'error':
        return <IdleScreen />
      case 'today_log':
        return <TodayLogScreen />
      case 'processing':
        return <ProcessingScreen />
      case 'purpose_select':
        return <PurposeSelectScreen />
      case 'entry_success':
        return <EntrySuccessScreen />
      case 'exit_pending':
        return <ExitPendingScreen />
      case 'exit_success':
        return <ExitSuccessScreen />
      case 'settings':
        return <SettingsScreen />
      case 'inside_list':
        return <InsideListScreen />
      case 'print_label':
        return <PrintLabelScreen />
      default:
        return <LoadingScreen />
    }
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      <SafeAreaView className="flex-1 bg-gray-50">
        {renderScreen()}
      </SafeAreaView>
      <UpdateModal />
    </>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <KioskApp />
    </SafeAreaProvider>
  )
}
