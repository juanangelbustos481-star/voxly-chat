import type { SupabaseClient } from '@supabase/supabase-js'

function decodeVapidKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const bytes = Uint8Array.from([...raw].map(character => character.charCodeAt(0)))
  return bytes.buffer as ArrayBuffer
}

export async function enableVoxlyPush(client: SupabaseClient, userId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Este navegador no admite notificaciones push. Prueba con Chrome o Edge actualizado.')
  }
  if (!window.isSecureContext) {
    throw new Error('Las notificaciones push requieren HTTPS. Abre Voxly desde su dirección segura.')
  }
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!publicKey) throw new Error('Falta configurar VITE_VAPID_PUBLIC_KEY en los secretos de Codespaces.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('No se concedió el permiso para mostrar notificaciones.')

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey)
    })
  }
  const json = subscription.toJSON()
  if (!json.endpoint) throw new Error('El navegador no generó un endpoint de notificaciones.')
  const { error } = await client.rpc('save_voxly_push_subscription', {
    target_endpoint: json.endpoint,
    target_subscription: json
  })
  if (error) throw error
}

export async function disableVoxlyPush(client: SupabaseClient): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  const { error } = await client.rpc('remove_voxly_push_subscription', {
    target_endpoint: endpoint
  })
  if (error) throw error
  await subscription.unsubscribe()
}
