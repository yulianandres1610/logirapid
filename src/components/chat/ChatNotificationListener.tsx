'use client'

import { useChatNotifications } from '@/hooks/useChatNotifications'

/**
 * Component that listens for new chat messages globally
 * and shows notifications when user is not in chat view
 */
export function ChatNotificationListener() {
  useChatNotifications()
  return null // This component doesn't render anything
}
