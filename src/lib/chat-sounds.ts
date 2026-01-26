// Chat notification sounds

const sounds = {
  newMessage: '/sounds/message.mp3',
  mention: '/sounds/mention.mp3',
  call: '/sounds/call.mp3'
}

let audioCache: Record<string, HTMLAudioElement> = {}

// Preload sounds
export function preloadSounds() {
  if (typeof window === 'undefined') return

  Object.entries(sounds).forEach(([key, src]) => {
    const audio = new Audio(src)
    audio.preload = 'auto'
    audioCache[key] = audio
  })
}

// Play a sound
export function playSound(type: keyof typeof sounds) {
  if (typeof window === 'undefined') return

  try {
    let audio = audioCache[type]
    if (!audio) {
      audio = new Audio(sounds[type])
      audioCache[type] = audio
    }

    audio.currentTime = 0
    audio.volume = 0.7
    audio.play().catch(() => {
      // Ignore autoplay restrictions
    })
  } catch {
    // Ignore errors
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

// Show browser notification
export function showNotification(
  title: string,
  body: string,
  options?: {
    icon?: string
    tag?: string
    onClick?: () => void
  }
) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null
  }

  if (Notification.permission !== 'granted') {
    return null
  }

  // Only show if page is not visible
  if (!document.hidden) {
    return null
  }

  const notification = new Notification(title, {
    body,
    icon: options?.icon || '/logo.png',
    tag: options?.tag,
    badge: '/logo.png'
  })

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus()
      options.onClick?.()
      notification.close()
    }
  }

  // Auto close after 5 seconds
  setTimeout(() => {
    notification.close()
  }, 5000)

  return notification
}

// Play sound and show notification for new message
export function notifyNewMessage(
  senderName: string,
  content: string,
  conversationId: number,
  onNotificationClick?: () => void
) {
  playSound('newMessage')

  showNotification(
    `Nuevo mensaje de ${senderName}`,
    content.length > 100 ? content.substring(0, 100) + '...' : content,
    {
      tag: `chat-${conversationId}`,
      onClick: onNotificationClick
    }
  )
}
