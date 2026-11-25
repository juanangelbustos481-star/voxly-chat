import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Reply, Pencil, Trash2, Check, X, Bookmark, Pin, Bot, Image, LogOut, MessageCircle, Mic, MoreVertical, Paperclip, Phone, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, UsersRound, Video, Bell, LockKeyhole, Mail, UserRound, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { useVoxlyCalls } from './lib/useVoxlyCalls'
import CallOverlay from './lib/CallOverlay'
import { disableVoxlyPush, enableVoxlyPush } from './lib/pushNotifications'

type Conversation = {
  conversation_id: string
  kind: string
  updated_at: string
  other_user_id: string | null
  other_display_name: string
  other_username: string
  last_message: string | null
  last_message_at: string | null
}
type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: string
  created_at: string
  attachment_url?: string | null
  attachment_signed_url?: string | null
  reply_to_message_id?: string | null
  edited_at?: string | null
  deleted_at?: string | null
}
type MessageReaction = { id: string; message_id: string; user_id: string; emoji: string }
type PinnedMessage = { id: string; conversation_id: string; message_id: string; pinned_by: string; created_at: string }
type SavedMessage = { id: string; message_id: string; created_at: string; messages: ChatMessage | ChatMessage[] }
type SearchUser = { id: string; username: string; display_name: string }
type GroupMember = { user_id: string; display_name: string; username: string; role: 'admin' | 'member'; joined_at: string }
type VoxlyNotification = { id: string; conversation_id: string; title: string; body: string; created_at: string; read: boolean }

const nav = [
  { label: 'Mensajes', icon: MessageCircle }, { label: 'Contactos', icon: Users },
  { label: 'Grupos', icon: UsersRound }, { label: 'Guardados', icon: Bookmark }, { label: 'Llamadas', icon: Phone }, { label: 'Voxly AI', icon: Bot }
]

function shortTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}
function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'V'
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'register') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } }
        })
        if (authError) throw authError
        if (data.session) setNotice('Tu cuenta está lista. Bienvenido a Voxly.')
        else {
          setNotice('Cuenta creada. Revisa tu correo para confirmar el registro y después inicia sesión.')
          setMode('login')
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div></div>
      <div className="auth-orbit"><div className="auth-orbit-inner"><MessageCircle size={35}/><Sparkles size={17}/></div></div>
      <p className="auth-eyebrow">TU ESPACIO, TU CONEXIÓN</p>
      <h1>{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h1>
      <p className="auth-subtitle">{mode === 'login' ? 'Inicia sesión para entrar a tu mundo Voxly.' : 'Únete a Voxly y mantente cerca de tu gente.'}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <label className="auth-field"><span>Nombre</span><div><UserRound size={17}/><input autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Cómo te llamas" required maxLength={60}/></div></label>}
        <label className="auth-field"><span>Correo electrónico</span><div><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" required/></div></label>
        <label className="auth-field"><span>Contraseña</span><div><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        {error && <p className="auth-message error">{error}</p>}
        {notice && <p className="auth-message success">{notice}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Un momento...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} <span>→</span></button>
      </form>
      <p className="auth-switch">{mode === 'login' ? '¿Todavía no tienes cuenta?' : '¿Ya tienes una cuenta?'} <button type="button" onClick={() => {setMode(mode === 'login' ? 'register' : 'login');setError('');setNotice('')}}>{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</button></p>
      <div className="auth-security"><ShieldCheck size={14}/> Tu cuenta está protegida por Supabase Auth</div>
    </section>
    <p className="auth-footer">VOXLY · COMUNICACIÓN SIN LÍMITES</p>
  </main>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [section, setSection] = useState('Mensajes')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [messageActionBusy, setMessageActionBusy] = useState<string | null>(null)
  const [messageReactions, setMessageReactions] = useState<MessageReaction[]>([])
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([])
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([])
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newChatMode, setNewChatMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [notifications, setNotifications] = useState<VoxlyNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [contactsQuery, setContactsQuery] = useState('')
  const [groupCreateMode, setGroupCreateMode] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<SearchUser[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupManageConversation, setGroupManageConversation] = useState<Conversation | null>(null)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false)
  const [groupAddMode, setGroupAddMode] = useState(false)
  const [addingGroupMembers, setAddingGroupMembers] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const voxlyCalls = useVoxlyCalls(supabase, session)

  useEffect(() => {
    if (!supabase || !session?.user.id || !('serviceWorker' in navigator)) {
      setPushEnabled(false)
      return
    }
    let active = true
    navigator.serviceWorker.getRegistration('/').then(async registration => {
      const subscription = await registration?.pushManager.getSubscription()
      if (!active || !subscription) {
        if (active) setPushEnabled(false)
        return
      }
      const { data } = await supabase!.from('push_subscriptions')
        .select('endpoint')
        .eq('endpoint', subscription.endpoint)
        .maybeSingle()
      if (active) setPushEnabled(Boolean(data))
    }).catch(() => { if (active) setPushEnabled(false) })
    return () => { active = false }
  }, [session?.user.id])

  async function togglePushNotifications() {
    if (!supabase || !session) return
    setPushBusy(true)
    try {
      if (pushEnabled) {
        await disableVoxlyPush(supabase)
        setPushEnabled(false)
        setError('Notificaciones push desactivadas en este dispositivo.')
      } else {
        await enableVoxlyPush(supabase)
        setPushEnabled(true)
        setError('¡Listo! Este dispositivo recibirá avisos push cuando llegue un mensaje.')
      }
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'No se pudieron configurar las notificaciones push.')
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadConversations() {
    if (!supabase) return
    setLoadingChats(true)
    const { data, error: loadError } = await supabase.rpc('list_my_voxly_conversations')
    if (loadError) {
      setError('No se pudieron cargar tus conversaciones. Comprueba que ejecutaste messaging_functions.sql en Supabase. ' + loadError.message)
      setLoadingChats(false)
      return
    }
    const rows = (data || []) as Conversation[]
    setConversations(rows)
    setSelected(current => current ? rows.find(row => row.conversation_id === current.conversation_id) || current : rows[0] || null)
    setLoadingChats(false)
  }

  useEffect(() => {
    if (session?.user.id) loadConversations()
    else {
      setConversations([])
      setSelected(null)
      setMessages([])
    }
  }, [session?.user.id])

  useEffect(() => {
    if (!supabase || !session) { setProfile(null); setProfileAvatar(''); setOnlineUserIds([]); return }
    let active = true
    supabase.from('profiles').select('id, username, display_name, avatar_url, bio').eq('id', session.user.id).maybeSingle().then(({data, error: profileError}) => {
      if (!active) return
      if (profileError) { setError('No se pudo cargar tu perfil: ' + profileError.message); return }
      const row = data as UserProfile | null
      if (row) { setProfile(row); setProfileName(row.display_name || ''); setProfileUsername(row.username || ''); setProfileBio(row.bio || ''); setProfileAvatar(row.avatar_url || '') }
    })
    return () => { active = false }
  }, [session?.user.id])

  useEffect(() => {
    if (!supabase || !session) return
    const presence = supabase.channel('voxly-presence', { config: { presence: { key: session.user.id } } })
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState<{ user_id: string }>()
        const ids = Object.values(state).flat().map(item => item.user_id)
        setOnlineUserIds(Array.from(new Set(ids)))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await presence.track({ user_id: session.user.id, online_at: new Date().toISOString() })
      })
    return () => { void supabase!.removeChannel(presence) }
  }, [session?.user.id])

  useEffect(() => {
    if (!supabase || !session) {
      setNotifications([])
      return
    }
    const channel = supabase.channel('voxly-notifications-' + session.user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, payload => {
        const incoming = payload.new as ChatMessage
        if (incoming.sender_id === session.user.id) return
        void (async () => {
          const { data } = await supabase!.rpc('list_my_voxly_conversations')
          const chats = (data || []) as Conversation[]
          const chat = chats.find(item => item.conversation_id === incoming.conversation_id)
          const senderName = chat?.other_display_name || 'Nuevo mensaje'
          const body = incoming.message_type === 'image' ? 'Te envió una fotografía'
            : incoming.message_type === 'audio' ? 'Te envió una nota de voz'
            : incoming.message_type === 'file' ? 'Te envió un archivo'
            : incoming.content
          const notification: VoxlyNotification = {
            id: incoming.id,
            conversation_id: incoming.conversation_id,
            title: senderName,
            body,
            created_at: incoming.created_at,
            read: selected?.conversation_id === incoming.conversation_id && document.visibilityState === 'visible'
          }
          setNotifications(current => current.some(item => item.id === notification.id) ? current : [notification, ...current].slice(0, 40))
          if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
            const browserNotice = new Notification('Voxly · ' + senderName, {
              body,
              tag: 'voxly-' + incoming.conversation_id
            })
            browserNotice.onclick = () => window.focus()
          }
          loadConversations()
        })()
      })
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [session?.user.id, selected?.conversation_id])

  useEffect(() => {
    if (!supabase || !session || (!newChatMode && !groupCreateMode && !groupAddMode) || searchTerm.trim().length < 2) {
      setSearchResults([])
      return
    }
    let active = true
    const timer = window.setTimeout(async () => {
      const { data, error: searchError } = await supabase!.rpc('search_voxly_users', { search_term: searchTerm.trim() })
      if (!active) return
      if (searchError) setError('No se pudo buscar usuarios: ' + searchError.message)
      else setSearchResults((data || []) as SearchUser[])
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchTerm, newChatMode, groupCreateMode, groupAddMode, session?.user.id])

  useEffect(() => {
    if (!supabase || !session) { setSavedMessages([]); return }
    void refreshSavedMessages()
  }, [session?.user.id])

  useEffect(() => {
    if (!supabase || !session || !selected) {
      setMessages([])
      return
    }
    let active = true
    setLoadingMessages(true)
    setMessages([])
    void refreshPinnedMessages(selected.conversation_id)
    supabase.from('messages').select('id, conversation_id, sender_id, content, message_type, attachment_url, reply_to_message_id, created_at, edited_at, deleted_at')
      .eq('conversation_id', selected.conversation_id)
      .order('created_at', { ascending: true })
      .then(async ({ data, error: messageError }) => {
        if (!active) return
        if (messageError) setError('No se pudieron cargar los mensajes: ' + messageError.message)
        else {
          const rows = (data || []) as ChatMessage[]
          const hydrated = await Promise.all(rows.map(async message => {
            if (!message.attachment_url) return message
            const { data: signed } = await supabase!.storage.from('voxly-attachments').createSignedUrl(message.attachment_url, 3600)
            return { ...message, attachment_signed_url: signed?.signedUrl || null }
          }))
          if (active) {
            setMessages(hydrated)
            if (rows.length) {
              const { data: reactionRows, error: reactionError } = await supabase!.from('message_reactions').select('id, message_id, user_id, emoji').in('message_id', rows.map(message => message.id))
              if (!reactionError && reactionRows) setMessageReactions(reactionRows as MessageReaction[])
            } else {
              setMessageReactions([])
            }
          }
        }
        setLoadingMessages(false)
      })

    const channel = supabase.channel('voxly-messages-' + selected.conversation_id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + selected.conversation_id
      }, payload => {
        const incoming = payload.new as ChatMessage
        void (async () => {
          let hydrated = incoming
          if (incoming.attachment_url) {
            const { data: signed } = await supabase!.storage.from('voxly-attachments').createSignedUrl(incoming.attachment_url, 3600)
            hydrated = { ...incoming, attachment_signed_url: signed?.signedUrl || null }
          }
          setMessages(current => current.some(message => message.id === hydrated.id) ? current : [...current, hydrated])
          loadConversations()
        })()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + selected.conversation_id }, payload => {
        const changed = payload.new as ChatMessage
        setMessages(current => current.map(message => message.id === changed.id ? { ...message, ...changed } : message))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_pins', filter: 'conversation_id=eq.' + selected.conversation_id }, () => {
        void refreshPinnedMessages(selected.conversation_id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        void refreshMessageReactions(selected.conversation_id)
      })
      .subscribe()

    return () => {
      active = false
      supabase!.removeChannel(channel)
    }
  }, [selected?.conversation_id, session?.user.id])

  async function refreshPinnedMessages(conversationId: string) {
    if (!supabase) return
    const { data, error: pinError } = await supabase.from('conversation_pins').select('id, conversation_id, message_id, pinned_by, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false })
    if (!pinError && data) setPinnedMessages(data as PinnedMessage[])
  }

  async function refreshSavedMessages() {
    if (!supabase || !session) return
    const { data, error: savedError } = await supabase.from('message_bookmarks').select('id, message_id, created_at, messages!inner(id, conversation_id, sender_id, content, message_type, created_at, deleted_at)').eq('user_id', session.user.id).order('created_at', { ascending: false })
    if (savedError) setError('No se pudieron cargar los mensajes guardados: ' + savedError.message)
    else setSavedMessages((data || []) as unknown as SavedMessage[])
  }

  async function toggleSavedMessage(message: ChatMessage) {
    if (!supabase || !session || savingMessageId) return
    setSavingMessageId(message.id)
    const existing = savedMessages.find(item => item.message_id === message.id)
    const result = existing
      ? await supabase.from('message_bookmarks').delete().eq('id', existing.id)
      : await supabase.from('message_bookmarks').insert({ message_id: message.id, user_id: session.user.id })
    if (result.error) setError('No se pudo actualizar el mensaje guardado: ' + result.error.message)
    else await refreshSavedMessages()
    setSavingMessageId(null)
  }

  async function togglePinnedMessage(message: ChatMessage) {
    if (!supabase || !session || savingMessageId || message.deleted_at) return
    setSavingMessageId(message.id)
    const existing = pinnedMessages.find(item => item.message_id === message.id)
    const result = existing
      ? await supabase.from('conversation_pins').delete().eq('id', existing.id)
      : await supabase.from('conversation_pins').insert({ conversation_id: message.conversation_id, message_id: message.id, pinned_by: session.user.id })
    if (result.error) setError('No se pudo actualizar el mensaje fijado: ' + result.error.message)
    else if (selected) await refreshPinnedMessages(selected.conversation_id)
    setSavingMessageId(null)
  }

  async function openSavedMessage(item: SavedMessage) {
    const message = Array.isArray(item.messages) ? item.messages[0] : item.messages
    if (!message) return
    const chat = conversations.find(row => row.conversation_id === message.conversation_id)
    if (!chat) { setError('Esta conversación ya no está disponible.'); return }
    setSelected(chat)
    setSection('Mensajes')
  }

  async function refreshMessageReactions(conversationId: string) {
    if (!supabase) return
    const { data: messageRows } = await supabase.from('messages').select('id').eq('conversation_id', conversationId)
    const ids = (messageRows || []).map(row => row.id)
    if (!ids.length) { setMessageReactions([]); return }
    const { data, error: reactionError } = await supabase.from('message_reactions').select('id, message_id, user_id, emoji').in('message_id', ids)
    if (!reactionError && data) setMessageReactions(data as MessageReaction[])
  }

  async function toggleMessageReaction(messageId: string, emoji: string) {
    if (!supabase || !session) return
    const existing = messageReactions.find(item => item.message_id === messageId && item.user_id === session.user.id && item.emoji === emoji)
    const result = existing
      ? await supabase.from('message_reactions').delete().eq('id', existing.id)
      : await supabase.from('message_reactions').insert({ message_id: messageId, user_id: session.user.id, emoji })
    if (result.error) setError('No se pudo guardar la reacción: ' + result.error.message)
    else if (selected) await refreshMessageReactions(selected.conversation_id)
  }

  async function startConversation(user: SearchUser) {
    if (!supabase) return
    setError('')
    const { data, error: createError } = await supabase.rpc('create_direct_conversation', { target_user: user.id })
    if (createError) {
      setError('No se pudo abrir el chat: ' + createError.message)
      return
    }
    const conversationId = data as string
    await loadConversations()
    const { data: rows } = await supabase.rpc('list_my_voxly_conversations')
    const found = ((rows || []) as Conversation[]).find(row => row.conversation_id === conversationId)
    if (found) setSelected(found)
    else setSelected({
      conversation_id: conversationId, kind: 'direct', updated_at: new Date().toISOString(),
      other_user_id: user.id, other_display_name: user.display_name,
      other_username: user.username, last_message: null, last_message_at: null
    })
    setNewChatMode(false)
    setSearchTerm('')
    setSearchResults([])
  }

  async function openGroupManagement(chat: Conversation) {
    setGroupManageConversation(chat); setGroupAddMode(false); setSelectedGroupMembers([])
    setSearchTerm(''); setSearchResults([]); setError(''); setLoadingGroupMembers(true)
    if (!supabase) return
    const { data, error: membersError } = await supabase.rpc('list_voxly_group_members', { target_conversation: chat.conversation_id })
    if (membersError) setError('No se pudieron cargar los integrantes: ' + membersError.message)
    else setGroupMembers((data || []) as GroupMember[])
    setLoadingGroupMembers(false)
  }

  async function refreshGroupMembers() {
    if (!supabase || !groupManageConversation) return
    const { data, error: membersError } = await supabase.rpc('list_voxly_group_members', { target_conversation: groupManageConversation.conversation_id })
    if (membersError) setError('No se pudo actualizar la lista: ' + membersError.message)
    else setGroupMembers((data || []) as GroupMember[])
  }

  async function addGroupMembers() {
    if (!supabase || !groupManageConversation || !selectedGroupMembers.length || addingGroupMembers) return
    setAddingGroupMembers(true); setError('')
    const { error: addError } = await supabase.rpc('add_voxly_group_members', {
      target_conversation: groupManageConversation.conversation_id,
      member_ids: selectedGroupMembers.map(member => member.id)
    })
    if (addError) setError('No se pudieron agregar los participantes: ' + addError.message)
    else { setSelectedGroupMembers([]); setSearchTerm(''); setSearchResults([]); setGroupAddMode(false); await refreshGroupMembers() }
    setAddingGroupMembers(false)
  }

  async function removeGroupMember(userId: string) {
    if (!supabase || !groupManageConversation || !session) return
    const isSelf = userId === session.user.id
    if (!window.confirm(isSelf ? '¿Quieres salir de este grupo?' : '¿Quieres retirar a esta persona del grupo?')) return
    const { error: removeError } = await supabase.rpc('remove_voxly_group_member', {
      target_conversation: groupManageConversation.conversation_id, target_user: userId
    })
    if (removeError) { setError('No se pudo completar la acción: ' + removeError.message); return }
    if (isSelf) { setGroupManageConversation(null); setGroupMembers([]); setSection('Grupos'); await loadConversations() }
    else await refreshGroupMembers()
  }

  async function createGroup() {
    if (!supabase || !session || creatingGroup) return
    const title = groupTitle.trim()
    if (!title) { setError('Escribe un nombre para el grupo.'); return }
    if (selectedGroupMembers.length < 1) { setError('Selecciona al menos a una persona para el grupo.'); return }
    setCreatingGroup(true)
    setError('')
    const { data, error: groupError } = await supabase.rpc('create_voxly_group', {
      group_title: title,
      member_ids: selectedGroupMembers.map(member => member.id)
    })
    if (groupError) {
      setError('No se pudo crear el grupo: ' + groupError.message)
      setCreatingGroup(false)
      return
    }
    const groupId = data as string
    const { data: rows, error: listError } = await supabase.rpc('list_my_voxly_conversations')
    if (listError) setError('El grupo se creó, pero no se pudo actualizar la lista: ' + listError.message)
    else {
      const chats = (rows || []) as Conversation[]
      setConversations(chats)
      const created = chats.find(chat => chat.conversation_id === groupId)
      if (created) { setSelected(created); setSection('Mensajes') }
    }
    setGroupCreateMode(false)
    setGroupTitle('')
    setSelectedGroupMembers([])
    setSearchTerm('')
    setSearchResults([])
    setCreatingGroup(false)
  }

  async function uploadAttachment(file: File | undefined) {
    if (!file || !selected || !supabase || !session || uploading) return
    if (file.size > 15 * 1024 * 1024) {
      setError('El archivo supera el límite de 15 MB.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-90) || 'archivo'
      const path = `${selected.conversation_id}/${session.user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('voxly-attachments').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (uploadError) throw uploadError
      const isImage = file.type.startsWith('image/')
      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: selected.conversation_id,
        sender_id: session.user.id,
        content: file.name,
        message_type: isImage ? 'image' : 'file',
        attachment_url: path
      })
      if (messageError) {
        await supabase.storage.from('voxly-attachments').remove([path])
        throw messageError
      }
      loadConversations()
    } catch (err) {
      setError('No se pudo adjuntar el archivo: ' + (err instanceof Error ? err.message : 'Error desconocido'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function uploadVoiceNote(blob: Blob) {
    if (!selected || !supabase || !session || uploading) return
    if (!blob.size) {
      setError('La grabación quedó vacía. Inténtalo de nuevo.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
      const path = `${selected.conversation_id}/${session.user.id}/${crypto.randomUUID()}-nota-de-voz.${extension}`
      const { error: uploadError } = await supabase.storage.from('voxly-attachments').upload(path, blob, {
        contentType: blob.type || 'audio/webm',
        upsert: false
      })
      if (uploadError) throw uploadError
      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: selected.conversation_id,
        sender_id: session.user.id,
        content: 'Nota de voz',
        message_type: 'audio',
        attachment_url: path
      })
      if (messageError) {
        await supabase.storage.from('voxly-attachments').remove([path])
        throw messageError
      }
      loadConversations()
    } catch (err) {
      setError('No se pudo enviar la nota de voz: ' + (err instanceof Error ? err.message : 'Error desconocido'))
    } finally {
      setUploading(false)
    }
  }

  async function toggleVoiceRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    if (!selected || !session || !supabase || uploading) return
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite grabar audio. Prueba con Chrome o Edge actualizado.')
      return
    }
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        if (audioBlob.size > 0) void uploadVoiceNote(audioBlob)
      }
      recorder.start()
      setRecording(true)
    } catch (err) {
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      setRecording(false)
      setError('No se pudo acceder al micrófono. Revisa el permiso del navegador y vuelve a intentarlo.')
    }
  }

  function beginEditMessage(message: ChatMessage) {
    if (message.sender_id !== session?.user.id || message.message_type !== 'text' || message.deleted_at) return
    setEditingMessageId(message.id)
    setEditDraft(message.content)
    setReplyTo(null)
  }

  async function saveEditedMessage(message: ChatMessage) {
    const content = editDraft.trim()
    if (!content || !supabase || !session || messageActionBusy) return
    setMessageActionBusy(message.id)
    const { data, error: editError } = await supabase.from('messages')
      .update({ content, edited_at: new Date().toISOString() })
      .eq('id', message.id).eq('sender_id', session.user.id).is('deleted_at', null)
      .select('id, content, edited_at').maybeSingle()
    if (editError || !data) setError('No se pudo editar el mensaje: ' + (editError?.message || 'No se encontró el mensaje o ya fue eliminado.'))
    else {
      setMessages(current => current.map(item => item.id === message.id ? { ...item, content: data.content, edited_at: data.edited_at } : item))
      setEditingMessageId(null)
      setEditDraft('')
    }
    setMessageActionBusy(null)
  }

  async function deleteMessage(message: ChatMessage) {
    if (!supabase || !session || message.sender_id !== session.user.id || message.deleted_at || messageActionBusy) return
    if (!window.confirm('¿Eliminar este mensaje para todos los integrantes de la conversación?')) return
    setMessageActionBusy(message.id)
    const { data, error: deleteError } = await supabase.from('messages')
      .update({ content: '', attachment_url: null, deleted_at: new Date().toISOString() })
      .eq('id', message.id).eq('sender_id', session.user.id).is('deleted_at', null)
      .select('id, content, attachment_url, deleted_at').maybeSingle()
    if (deleteError || !data) setError('No se pudo eliminar el mensaje: ' + (deleteError?.message || 'No se encontró el mensaje o ya fue eliminado.'))
    else {
      setMessages(current => current.map(item => item.id === message.id ? { ...item, content: '', attachment_url: null, attachment_signed_url: null, deleted_at: data.deleted_at } : item))
      setMessageReactions(current => current.filter(item => item.message_id !== message.id))
      if (replyTo?.id === message.id) setReplyTo(null)
      if (editingMessageId === message.id) { setEditingMessageId(null); setEditDraft('') }
    }
    setMessageActionBusy(null)
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !selected || !supabase || !session || sending) return
    setSending(true)
    setError('')
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: selected.conversation_id,
      sender_id: session.user.id,
      content,
      message_type: 'text',
      reply_to_message_id: replyTo?.id || null
    })
    if (sendError) setError('No se pudo enviar el mensaje: ' + sendError.message)
    else {
      setDraft('')
      setReplyTo(null)
      loadConversations()
    }
    setSending(false)
  }

  if (!isSupabaseConfigured || !supabase) {
    return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div></div><h1>Falta configurar Supabase</h1><p className="auth-subtitle">Comprueba las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el entorno de Codespaces y reinicia el servidor.</p></section></main>
  }
  if (authLoading) return <main className="auth-screen"><div className="auth-loading"><div className="brand-icon">V</div><p>Preparando tu espacio Voxly...</p></div></main>
  if (!session) return <AuthScreen />

  const displayName = profile?.display_name || session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Tu perfil'
  const initial = initials(displayName)
  const callPeerName = voxlyCalls.call
    ? conversations.find(chat => chat.conversation_id === voxlyCalls.call?.conversation_id)?.other_display_name || 'Contacto Voxly'
    : voxlyCalls.incomingCall
      ? conversations.find(chat => chat.conversation_id === voxlyCalls.incomingCall?.conversation_id)?.other_display_name || 'Alguien de Voxly'
      : 'Contacto Voxly'

  async function signOut() {
    const { error: signOutError } = await supabase!.auth.signOut()
    if (signOutError) window.alert('No se pudo cerrar sesión: ' + signOutError.message)
  }

  return <main className="shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div><button className="close-menu" onClick={() => setMenuOpen(false)}>×</button></div>
      <button type="button" className="account account-button" onClick={() => setSection('Mi perfil')}><div className="avatar user">{profileAvatar ? <img src={profileAvatar} alt="Foto de perfil"/> : initial}</div><div><b>{displayName}</b><small>@{profile?.username || 'configura tu usuario'}</small></div><i className="online"/></button>
      <p className="overline">ESPACIO DE TRABAJO</p>
      <nav>{nav.map(({label, icon: Icon}) => <button key={label} onClick={() => {setSection(label);setMenuOpen(false)}} className={section === label ? 'nav active' : 'nav'}><Icon size={18}/>{label}{label === 'Mensajes' && conversations.length > 0 && <em>{conversations.length}</em>}</button>)}</nav>
      <div className="side-bottom"><div className="promo"><Sparkles size={17}/><b>Tu mundo, conectado</b><p>Todo lo que necesitas para comunicarte, en un solo lugar.</p></div><button className="nav"><Settings size={18}/>Configuración</button><button className="nav signout" onClick={signOut}><LogOut size={18}/>Cerrar sesión</button><small className="privacy"><ShieldCheck size={14}/> Privacidad primero</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}>☰</button><div><small className="overline">TU ESPACIO PERSONAL</small><h1>{section}</h1></div><div className="top-right"><span className="connection"><i/> Cuenta conectada</span><div className="notification-wrap"><button className="bell" aria-label="Notificaciones" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(value => !value)}><Bell size={19}/>{notifications.some(item => !item.read) && <span className="notification-count">{notifications.filter(item => !item.read).length > 9 ? '9+' : notifications.filter(item => !item.read).length}</span>}</button>{notificationsOpen && <div className="notification-panel"><div className="notification-heading"><div><b>Notificaciones</b><small>{notifications.filter(item => !item.read).length} sin leer</small></div><button type="button" onClick={() => setNotifications(current => current.map(item => ({...item, read:true})))}>Marcar leídas</button></div><button type="button" className="notification-permission" onClick={togglePushNotifications} disabled={pushBusy}>{pushBusy ? 'Configurando notificaciones…' : pushEnabled ? 'Desactivar notificaciones push en este dispositivo' : 'Activar notificaciones aunque Voxly esté cerrado'}</button>{notifications.length ? <div className="notification-items">{notifications.map(item => <button type="button" key={item.id} className={item.read ? 'notification-item' : 'notification-item unread'} onClick={() => { const chat = conversations.find(row => row.conversation_id === item.conversation_id); if (chat) setSelected(chat); setSection('Mensajes'); setNotifications(current => current.map(note => note.id === item.id ? {...note,read:true} : note)); setNotificationsOpen(false) }}><span className="notification-dot"/><span className="notification-copy"><b>{item.title}</b><span>{item.body}</span><small>{shortTime(item.created_at)}</small></span></button>)}</div> : <p className="notification-empty">Todavía no tienes notificaciones.</p>}</div>}</div><button type="button" className="avatar user small top-avatar" onClick={() => setSection('Mi perfil')} aria-label="Abrir mi perfil">{profileAvatar ? <img src={profileAvatar} alt="Foto de perfil"/> : initial}</button></div></header>
      {section === 'Guardados' ? <section className="saved-page"><div className="saved-heading"><div><h2>Mensajes guardados</h2><p>Tu colección personal de mensajes importantes.</p></div><span>{savedMessages.length} guardados</span></div>{savedMessages.length ? <div className="saved-list">{savedMessages.map(item => {const message=Array.isArray(item.messages)?item.messages[0]:item.messages;const chat=message?conversations.find(row=>row.conversation_id===message.conversation_id):null;return message ? <article className="saved-card" key={item.id}><div className="saved-card-icon"><Bookmark size={17}/></div><div className="saved-card-copy"><b>{chat?.other_display_name || 'Conversación'}</b><p>{message.deleted_at ? 'Este mensaje fue eliminado' : message.content || (message.message_type==='image'?'📷 Imagen':message.message_type==='audio'?'🎙️ Nota de voz':'Archivo adjunto')}</p><small>{shortTime(message.created_at)}</small></div><button type="button" onClick={() => openSavedMessage(item)}>Abrir chat</button><button type="button" className="saved-remove" onClick={() => toggleSavedMessage(message)}>Quitar</button></article> : null})}</div> : <div className="saved-empty"><Bookmark size={34}/><b>Aún no guardas mensajes</b><p>Usa el icono de marcador en cualquier mensaje para guardarlo aquí.</p></div>}</section> : section === 'Llamadas' ? <section className="calls-page">
        <div className="calls-intro"><div className="calls-intro-icon"><Phone size={25}/></div><div><h2>Llamadas de Voxly</h2><p>Comunícate por voz o video con tus contactos.</p></div></div>
        <div className="calls-notice"><ShieldCheck size={17}/><span>Las llamadas usan WebRTC y requieren permiso para acceder al micrófono o cámara. Mantén Voxly abierto durante la llamada.</span></div>
        <h3>Iniciar una llamada</h3>
        <div className="calls-contact-grid">
          {conversations.filter(chat => chat.kind === 'direct' && chat.other_user_id).map(chat => <article className="calls-contact-card" key={chat.conversation_id}>
            <div className="avatar violet">{initials(chat.other_display_name)}</div><div className="calls-contact-info"><b>{chat.other_display_name}</b><small>@{chat.other_username}</small></div>
            <button aria-label={'Llamar a ' + chat.other_display_name} title="Llamada de voz" onClick={() => voxlyCalls.startCall(chat.conversation_id, chat.other_user_id, 'audio')}><Phone size={17}/></button>
            <button aria-label={'Videollamar a ' + chat.other_display_name} title="Videollamada" onClick={() => voxlyCalls.startCall(chat.conversation_id, chat.other_user_id, 'video')}><Video size={18}/></button>
          </article>)}
          {!conversations.some(chat => chat.kind === 'direct' && chat.other_user_id) && <div className="contacts-empty"><Phone size={30}/><b>Aún no tienes contactos para llamar</b><p>Primero inicia una conversación individual desde Contactos.</p><button onClick={() => setSection('Contactos')}>Ver contactos</button></div>}
        </div>
      </section> : section === 'Grupos' ? <section className="groups-page">
        {groupManageConversation ? <>
          <div className="groups-toolbar"><div><h2>Administrar grupo</h2><p>{groupManageConversation.other_display_name}</p></div><button className="contacts-add" onClick={() => {setGroupManageConversation(null);setGroupMembers([]);setGroupAddMode(false);setSearchTerm('')}}>Volver a grupos</button></div>
          <div className="group-manage-card">
            <div className="group-manage-heading"><div><h3>Participantes</h3><small>{groupMembers.length} de 50 integrantes</small></div><button className="contacts-add" onClick={() => {setGroupAddMode(value => !value);setSelectedGroupMembers([]);setSearchTerm('');setSearchResults([])}}><Plus size={15}/>{groupAddMode ? 'Cancelar' : 'Agregar personas'}</button></div>
            {loadingGroupMembers ? <p className="group-loading">Cargando integrantes...</p> : <div className="group-member-list">
              {groupMembers.map(member => <div className="group-member-row" key={member.user_id}><div className="avatar violet">{initials(member.display_name)}</div><div className="group-member-info"><b>{member.display_name}{member.user_id === session?.user.id ? ' (Tú)' : ''}</b><small>@{member.username}</small></div><span className={member.role === 'admin' ? 'group-role admin' : 'group-role'}>{member.role === 'admin' ? 'Administrador' : 'Miembro'}</span>{(groupMembers.find(item => item.user_id === session?.user.id)?.role === 'admin' && member.user_id !== session?.user.id) && <button className="group-remove" onClick={() => removeGroupMember(member.user_id)}>Retirar</button>}</div>)}
            </div>}
            {groupAddMode && <div className="group-add-panel"><label className="group-field"><span>Buscar personas</span><div className="group-search"><Search size={16}/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Nombre o @usuario..."/></div></label>
              <div className="group-selected"><b>Seleccionados ({selectedGroupMembers.length})</b>{selectedGroupMembers.map(member => <button type="button" key={member.id} onClick={() => setSelectedGroupMembers(current => current.filter(item => item.id !== member.id))}>{member.display_name} ×</button>)}</div>
              <div className="group-search-results">{searchTerm.trim().length < 2 ? <p>Escribe al menos 2 caracteres para buscar.</p> : searchResults.filter(user => !groupMembers.some(member => member.user_id === user.id)).length ? searchResults.filter(user => !groupMembers.some(member => member.user_id === user.id)).map(user => {const chosen=selectedGroupMembers.some(member=>member.id===user.id);return <button type="button" key={user.id} className={chosen?'group-user chosen':'group-user'} onClick={() => setSelectedGroupMembers(current => chosen ? current.filter(item=>item.id!==user.id) : [...current,user])}><div className="avatar violet">{initials(user.display_name)}</div><span><b>{user.display_name}</b><small>@{user.username}</small></span><span className="group-check">{chosen?'✓':'+'}</span></button>}) : <p>No hay personas nuevas en los resultados.</p>}</div>
              <button className="group-create-submit" disabled={addingGroupMembers || !selectedGroupMembers.length} onClick={addGroupMembers}>{addingGroupMembers ? 'Agregando...' : 'Agregar al grupo'}</button>
            </div>}
            <button className="group-leave" onClick={() => removeGroupMember(session!.user.id)}>Salir del grupo</button>
          </div>
        </> : <>
          <div className="groups-toolbar"><div><h2>Grupos de Voxly</h2><p>Crea espacios para conversar con varias personas.</p></div><button className="contacts-add" onClick={() => {setGroupCreateMode(value => !value);setGroupTitle('');setSelectedGroupMembers([]);setSearchTerm('');setSearchResults([]);setError('')}}><Plus size={16}/>{groupCreateMode ? 'Cancelar' : 'Crear grupo'}</button></div>
          {groupCreateMode ? <div className="group-create-card">
            <label className="group-field"><span>Nombre del grupo</span><input value={groupTitle} onChange={e => setGroupTitle(e.target.value)} placeholder="Ej. Amigos, escuela, equipo..." maxLength={60}/></label>
            <label className="group-field"><span>Buscar personas para agregar</span><div className="group-search"><Search size={16}/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Escribe un nombre o @usuario..."/></div></label>
            <div className="group-selected"><b>Participantes seleccionados ({selectedGroupMembers.length})</b>{selectedGroupMembers.length ? selectedGroupMembers.map(member => <button type="button" key={member.id} onClick={() => setSelectedGroupMembers(current => current.filter(item => item.id !== member.id))}>{member.display_name} ×</button>) : <small>Selecciona al menos una persona.</small>}</div>
            <div className="group-search-results">{searchTerm.trim().length < 2 ? <p>Escribe al menos 2 caracteres para buscar personas.</p> : searchResults.length ? searchResults.map(user => {const chosen=selectedGroupMembers.some(member=>member.id===user.id);return <button type="button" key={user.id} className={chosen?'group-user chosen':'group-user'} onClick={() => setSelectedGroupMembers(current => chosen ? current.filter(item=>item.id!==user.id) : [...current,user])}><div className="avatar violet">{initials(user.display_name)}</div><span><b>{user.display_name}</b><small>@{user.username}</small></span><span className="group-check">{chosen?'✓':'+'}</span></button>}) : <p>No se encontraron personas.</p>}</div>
            <button className="group-create-submit" disabled={creatingGroup || !groupTitle.trim() || selectedGroupMembers.length===0} onClick={createGroup}>{creatingGroup ? 'Creando grupo...' : 'Crear grupo y abrir chat'}</button>
          </div> : <div className="groups-grid">
            {conversations.filter(chat => chat.kind === 'group').map(chat => <article className="group-card" key={chat.conversation_id}><div className="group-card-icon"><UsersRound size={22}/></div><div className="group-card-info"><b>{chat.other_display_name}</b><small>{chat.last_message || 'Grupo creado. ¡Envía el primer mensaje!'}</small><time>{shortTime(chat.last_message_at || chat.updated_at)}</time></div><button onClick={() => openGroupManagement(chat)}><Users size={15}/> Administrar</button><button onClick={() => {setSelected(chat);setSection('Mensajes')}}><MessageCircle size={16}/> Abrir</button></article>)}
            {!conversations.some(chat => chat.kind === 'group') && <div className="contacts-empty"><UsersRound size={32}/><b>Aún no tienes grupos</b><p>Crea un grupo, agrega personas y comienza a conversar en un mismo espacio.</p><button onClick={() => setGroupCreateMode(true)}><Plus size={16}/> Crear primer grupo</button></div>}
          </div>}
        </>}
      </section> : section === 'Contactos' ? <section className="contacts-page">
        <div className="contacts-toolbar">
          <div><h2>Tus contactos</h2><p>Personas con las que ya tienes una conversación en Voxly.</p></div>
          <button className="contacts-add" onClick={() => {setSection('Mensajes');setNewChatMode(true);setSearchTerm('')}}><Plus size={16}/> Buscar personas</button>
        </div>
        <label className="contacts-search"><Search size={17}/><input value={contactsQuery} onChange={e => setContactsQuery(e.target.value)} placeholder="Buscar por nombre o usuario..."/></label>
        <div className="contacts-grid">
          {conversations.filter(chat => chat.kind === 'direct' && (chat.other_display_name.toLowerCase().includes(contactsQuery.toLowerCase()) || chat.other_username.toLowerCase().includes(contactsQuery.toLowerCase()))).map(chat => <article className="contact-card" key={chat.conversation_id}>
            <div className="avatar violet contact-avatar">{initials(chat.other_display_name)}</div>
            <div className="contact-details"><b>{chat.other_display_name}</b><small>@{chat.other_username}</small><span>{chat.last_message || 'Todavía no hay mensajes'}</span></div>
            <button onClick={() => {setSelected(chat);setSection('Mensajes')}}><MessageCircle size={16}/> Mensaje</button>
          </article>)}
          {!conversations.some(chat => chat.kind === 'direct' && (chat.other_display_name.toLowerCase().includes(contactsQuery.toLowerCase()) || chat.other_username.toLowerCase().includes(contactsQuery.toLowerCase()))) && <div className="contacts-empty"><Users size={30}/><b>{contactsQuery ? 'No hay resultados' : 'Aún no tienes contactos'}</b><p>{contactsQuery ? 'Prueba con otro nombre o usuario.' : 'Busca personas en Voxly para iniciar una conversación. Tus chats aparecerán aquí.'}</p><button onClick={() => {setSection('Mensajes');setNewChatMode(true);setSearchTerm('')}}><Plus size={16}/> Encontrar personas</button></div>}
        </div>
      </section> : section === 'Mensajes' ? <div className={`messenger ${selected ? 'has-selected' : ''}`}>
        <aside className="chat-list">
          <div className="list-heading"><div><h2>{newChatMode ? 'Nuevo mensaje' : 'Conversaciones'}</h2><p>{newChatMode ? 'Busca a alguien en Voxly.' : 'Tus conversaciones reales.'}</p></div><button className="add" aria-label={newChatMode ? 'Cancelar nuevo chat' : 'Nuevo chat'} onClick={() => {setNewChatMode(value => !value);setSearchTerm('');setSearchResults([]);setError('')}}>{newChatMode ? <span>×</span> : <Plus size={18}/>}</button></div>
          <label className="search"><Search size={16}/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={newChatMode ? 'Nombre o @usuario...' : 'Buscar conversaciones...'}/></label>
          {newChatMode ? <div className="search-users">
            {searchTerm.trim().length < 2 ? <p className="empty-list">Escribe al menos 2 caracteres para buscar personas.</p> : searchResults.length ? searchResults.map(user => <button className="user-result" key={user.id} onClick={() => startConversation(user)}><div className="avatar violet">{initials(user.display_name)}</div><span><b>{user.display_name}</b><small>@{user.username}</small></span><MessageCircle size={16}/></button>) : <p className="empty-list">No se encontraron usuarios.</p>}
          </div> : <div className="real-chat-list">
            {loadingChats ? <p className="empty-list">Cargando conversaciones...</p> : conversations.length ? conversations.map(chat => <button key={chat.conversation_id} onClick={() => setSelected(chat)} className={selected?.conversation_id === chat.conversation_id ? 'chat selected' : 'chat'}><div className="avatar violet">{initials(chat.other_display_name)}</div><div className="chat-info"><div className="chat-title"><b>{chat.other_display_name}</b><time>{shortTime(chat.last_message_at || chat.updated_at)}</time></div><div className="chat-text"><span>{chat.last_message || 'Inicia la conversación'}</span></div></div></button>) : <p className="empty-list">Todavía no tienes chats. Pulsa + para buscar a otra persona.</p>}
          </div>}
          <div className="list-foot">Voxly está conectado <i/></div>
        </aside>
        <section className="conversation">
          {selected ? <>
            <div className="conversation-head"><button className="mobile-back" onClick={() => setSelected(null)} aria-label="Volver a conversaciones"><ArrowLeft size={18}/></button><div className="avatar violet">{initials(selected.other_display_name)}</div><div className="person"><b>{selected.other_display_name}</b><small>@{selected.other_username}</small></div><div className="actions"><button aria-label="Llamada de voz" title={selected.kind === 'direct' ? 'Llamada de voz' : 'Las llamadas grupales aún no están disponibles'} disabled={selected.kind !== 'direct' || !!voxlyCalls.call || !!voxlyCalls.incomingCall} onClick={() => voxlyCalls.startCall(selected.conversation_id, selected.other_user_id, 'audio')}><Phone size={18}/></button><button aria-label="Videollamada" title={selected.kind === 'direct' ? 'Videollamada' : 'Las llamadas grupales aún no están disponibles'} disabled={selected.kind !== 'direct' || !!voxlyCalls.call || !!voxlyCalls.incomingCall} onClick={() => voxlyCalls.startCall(selected.conversation_id, selected.other_user_id, 'video')}><Video size={19}/></button><button aria-label="Más opciones"><MoreVertical size={19}/></button></div></div>
            {pinnedMessages.length > 0 && <div className="pinned-strip"><div className="pinned-strip-title"><Pin size={14}/><b>Mensajes fijados</b><small>{pinnedMessages.length}</small></div><div className="pinned-strip-items">{pinnedMessages.map(pin => {const pinned = messages.find(item => item.id === pin.message_id);return pinned ? <button type="button" key={pin.id} onClick={() => document.getElementById('message-' + pinned.id)?.scrollIntoView({behavior:'smooth',block:'center'})}><span>{pinned.deleted_at ? 'Mensaje eliminado' : pinned.content || (pinned.message_type === 'image' ? '📷 Imagen' : 'Archivo o nota de voz')}</span><small>{shortTime(pinned.created_at)}</small></button> : null})}</div></div>}
            <div className="messages">
              <div className="day">MENSAJES DE VOXLY</div>
              {loadingMessages ? <p className="empty-messages">Cargando mensajes...</p> : messages.length ? messages.map(message => <div id={'message-' + message.id} key={message.id} className={message.sender_id === session.user.id ? 'message outgoing' : 'message incoming'}><div className="bubble">{message.deleted_at ? <span className="deleted-message">Este mensaje fue eliminado</span> : editingMessageId === message.id ? <div className="message-edit-box"><textarea value={editDraft} maxLength={5000} onChange={event => setEditDraft(event.target.value)} aria-label="Editar mensaje"/><div><button type="button" disabled={!editDraft.trim() || messageActionBusy === message.id} onClick={() => saveEditedMessage(message)}><Check size={14}/> Guardar</button><button type="button" onClick={() => {setEditingMessageId(null);setEditDraft('')}}><X size={14}/> Cancelar</button></div></div> : <>{message.reply_to_message_id && <div className="reply-quote"><b>Respuesta a un mensaje</b><span>{messages.find(item => item.id === message.reply_to_message_id)?.deleted_at ? 'Mensaje eliminado' : messages.find(item => item.id === message.reply_to_message_id)?.content || 'Mensaje original no disponible'}</span></div>}{message.message_type === 'audio' && message.attachment_signed_url ? <div className="audio-message"><span>🎙️ Nota de voz</span><audio controls preload="metadata" src={message.attachment_signed_url}>Tu navegador no puede reproducir este audio.</audio></div> : message.message_type === 'image' && message.attachment_signed_url ? <a href={message.attachment_signed_url} target="_blank" rel="noreferrer"><img className="message-image" src={message.attachment_signed_url} alt={message.content} loading="lazy"/></a> : message.attachment_signed_url ? <a className="message-file" href={message.attachment_signed_url} target="_blank" rel="noreferrer">📎 {message.content}</a> : message.attachment_url ? <span>📎 {message.content}</span> : message.content}</>}</div><div className="message-meta"><time>{shortTime(message.created_at)}</time>{message.edited_at && !message.deleted_at && <small className="edited-label">Editado</small>}{!message.deleted_at && <>{['👍', '❤️', '😂', '😮'].map(emoji => { const items = messageReactions.filter(item => item.message_id === message.id && item.emoji === emoji); const mine = items.some(item => item.user_id === session.user.id); return <button key={emoji} type="button" className={'message-reaction' + (mine ? ' selected' : '')} title={'Reaccionar con ' + emoji} aria-label={'Reaccionar con ' + emoji} onClick={() => toggleMessageReaction(message.id, emoji)}>{emoji}{items.length > 0 && <small>{items.length}</small>}</button> })}<button type="button" className="message-reply" title="Responder" aria-label="Responder a este mensaje" onClick={() => setReplyTo(message)}><Reply size={13}/></button><button type="button" className={'message-action bookmark-action' + (savedMessages.some(item => item.message_id === message.id) ? ' active' : '')} title={savedMessages.some(item => item.message_id === message.id) ? 'Quitar de guardados' : 'Guardar mensaje'} aria-label="Guardar mensaje" disabled={savingMessageId === message.id} onClick={() => toggleSavedMessage(message)}><Bookmark size={13}/></button><button type="button" className={'message-action pin-action' + (pinnedMessages.some(item => item.message_id === message.id) ? ' active' : '')} title={pinnedMessages.some(item => item.message_id === message.id) ? 'Desfijar mensaje' : 'Fijar mensaje'} aria-label="Fijar mensaje" disabled={savingMessageId === message.id} onClick={() => togglePinnedMessage(message)}><Pin size={13}/></button>{message.sender_id === session.user.id && message.message_type === 'text' && <button type="button" className="message-action" title="Editar mensaje" aria-label="Editar mensaje" onClick={() => beginEditMessage(message)}><Pencil size={13}/></button>}{message.sender_id === session.user.id && <button type="button" className="message-action danger" title="Eliminar mensaje" aria-label="Eliminar mensaje" disabled={messageActionBusy === message.id} onClick={() => deleteMessage(message)}><Trash2 size={13}/></button>}</>}</div></div>) : <div className="empty-messages"><MessageCircle size={27}/><b>Esta conversación está lista</b><span>Envía el primer mensaje para comenzar.</span></div>}
            </div>
            {replyTo && <div className="reply-composer"><div><b>Respondiendo a {replyTo.sender_id === session.user.id ? 'ti' : selected.other_display_name}</b><span>{replyTo.content}</span></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancelar respuesta">×</button></div>}
            <form className="composer" onSubmit={sendMessage}><input ref={fileInputRef} className="hidden-file-input" type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.xlsx,.pptx" onChange={e => uploadAttachment(e.target.files?.[0])}/><button type="button" aria-label="Adjuntar archivo" title="Adjuntar archivo (máx. 15 MB)" disabled={uploading} onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.xlsx,.pptx'; fileInputRef.current.click() } }}><Paperclip size={18}/></button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={`Escribe un mensaje a ${selected.other_display_name}...`}/><button type="button" aria-label="Enviar fotografía" title="Enviar fotografía" disabled={uploading} onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click() } }}><Image size={18}/></button><button type="button" aria-label={recording ? 'Detener grabación' : 'Grabar nota de voz'} title={recording ? 'Detener y enviar nota de voz' : 'Grabar nota de voz'} disabled={uploading} className={recording ? 'recording-button' : ''} onClick={toggleVoiceRecording}><Mic size={18}/></button><button className="send" type="submit" disabled={!draft.trim() || sending} aria-label="Enviar"><Send size={17}/></button></form>
            <p className={recording ? 'hint recording-hint' : 'hint'}>{recording ? 'Grabando nota de voz… pulsa el micrófono para detener y enviar.' : uploading ? 'Subiendo archivo o nota de voz…' : 'Tus mensajes se guardan en Supabase y se actualizan en tiempo real.'}</p>
          </> : <div className="empty-conversation"><MessageCircle size={42}/><h2>Tu espacio de conversación</h2><p>Selecciona un chat o pulsa + para encontrar personas en Voxly.</p></div>}
        </section>
      </div> : <div className="placeholder"><div className="placeholder-icon">{section === 'Llamadas' ? <Phone/> : <Bot/>}</div><h2>{section}</h2><p>Esta sección se implementará en las siguientes etapas.</p><span><Sparkles size={14}/> Próximamente en Voxly</span></div>}
      {voxlyCalls.callError && <div className="app-error call-error" role="alert"><span>{voxlyCalls.callError}</span><button onClick={voxlyCalls.clearCallError}>×</button></div>}
      {error && <div className="app-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
      <CallOverlay call={voxlyCalls.call} incomingCall={voxlyCalls.incomingCall} localStream={voxlyCalls.localStream} remoteStream={voxlyCalls.remoteStream} muted={voxlyCalls.muted} cameraOff={voxlyCalls.cameraOff} peerName={callPeerName} onAccept={voxlyCalls.acceptCall} onReject={voxlyCalls.rejectCall} onEnd={voxlyCalls.endCall} onMute={voxlyCalls.toggleMute} onCamera={voxlyCalls.toggleCamera}/>
    </section>
  </main>
}
