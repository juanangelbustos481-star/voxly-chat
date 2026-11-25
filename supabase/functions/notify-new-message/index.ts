import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.57.0'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-voxly-webhook-secret' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const expectedSecret = Deno.env.get('VOXLY_WEBHOOK_SECRET')
  if (!expectedSecret || request.headers.get('x-voxly-webhook-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const payload = await request.json()
    const message = payload.record ?? payload
    const conversationId = message.conversation_id
    const senderId = message.sender_id
    if (!conversationId || !senderId) return new Response('Missing message fields', { status: 400 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@voxly.app'
    if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
      return new Response('Push server secrets are not configured', { status: 500 })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: members, error: membersError } = await admin
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId)
    if (membersError) throw membersError
    const recipientIds = (members ?? []).map((member) => member.user_id)
    if (!recipientIds.length) return Response.json({ sent: 0 })

    const [{ data: subscriptions, error: subscriptionsError }, { data: sender }] = await Promise.all([
      admin.from('push_subscriptions').select('endpoint, subscription').in('user_id', recipientIds),
      admin.from('profiles').select('display_name').eq('id', senderId).maybeSingle()
    ])
    if (subscriptionsError) throw subscriptionsError
    const senderName = sender?.display_name || 'Nuevo mensaje'
    const messageType = message.message_type
    const body = messageType === 'image' ? 'Te envió una fotografía'
      : messageType === 'audio' ? 'Te envió una nota de voz'
      : messageType === 'file' ? 'Te envió un archivo'
      : 'Te envió un mensaje'
    const notification = JSON.stringify({
      title: 'Voxly · ' + senderName,
      body,
      url: '/',
      tag: 'voxly-' + conversationId
    })

    let sent = 0
    for (const item of subscriptions ?? []) {
      try {
        await webpush.sendNotification(item.subscription, notification, { TTL: 60, urgency: 'normal' })
        sent++
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', item.endpoint)
        } else {
          console.error('Push delivery failed:', statusCode ?? 'unknown')
        }
      }
    }
    return Response.json({ sent })
  } catch (error) {
    console.error('Push webhook error:', error)
    return new Response('Unable to process push notification', { status: 500 })
  }
})
