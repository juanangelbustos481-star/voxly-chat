import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Bot, Image, LogOut, MessageCircle, Mic, MoreVertical, Paperclip, Phone, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, UsersRound, Video, Bell, LockKeyhole, Mail, UserRound, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

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
}
type SearchUser = { id: string; username: string; display_name: string }

const nav = [
  { label: 'Mensajes', icon: MessageCircle }, { label: 'Contactos', icon: Users },
  { label: 'Grupos', icon: UsersRound }, { label: 'Llamadas', icon: Phone }, { label: 'Voxly AI', icon: Bot }
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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [newChatMode, setNewChatMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

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
    if (!supabase || !session || !newChatMode || searchTerm.trim().length < 2) {
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
  }, [searchTerm, newChatMode, session?.user.id])

  useEffect(() => {
    if (!supabase || !session || !selected) {
      setMessages([])
      return
    }
    let active = true
    setLoadingMessages(true)
    setMessages([])
    supabase.from('messages').select('id, conversation_id, sender_id, content, message_type, attachment_url, created_at')
      .eq('conversation_id', selected.conversation_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .then(({ data, error: messageError }) => {
        if (!active) return
        if (messageError) setError('No se pudieron cargar los mensajes: ' + messageError.message)
        else {
          const rows = (data || []) as ChatMessage[]
          const hydrated = await Promise.all(rows.map(async message => {
            if (!message.attachment_url) return message
            const { data: signed } = await supabase!.storage.from('voxly-attachments').createSignedUrl(message.attachment_url, 3600)
            return { ...message, attachment_signed_url: signed?.signedUrl || null }
          }))
          if (active) setMessages(hydrated)
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
      .subscribe()

    return () => {
      active = false
      supabase!.removeChannel(channel)
    }
  }, [selected?.conversation_id, session?.user.id])

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
      message_type: 'text'
    })
    if (sendError) setError('No se pudo enviar el mensaje: ' + sendError.message)
    else {
      setDraft('')
      loadConversations()
    }
    setSending(false)
  }

  if (!isSupabaseConfigured || !supabase) {
    return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div></div><h1>Falta configurar Supabase</h1><p className="auth-subtitle">Comprueba las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el entorno de Codespaces y reinicia el servidor.</p></section></main>
  }
  if (authLoading) return <main className="auth-screen"><div className="auth-loading"><div className="brand-icon">V</div><p>Preparando tu espacio Voxly...</p></div></main>
  if (!session) return <AuthScreen />

  const displayName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Tu perfil'
  const initial = initials(displayName)

  async function signOut() {
    const { error: signOutError } = await supabase!.auth.signOut()
    if (signOutError) window.alert('No se pudo cerrar sesión: ' + signOutError.message)
  }

  return <main className="shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div><button className="close-menu" onClick={() => setMenuOpen(false)}>×</button></div>
      <div className="account"><div className="avatar user">{initial}</div><div><b>{displayName}</b><small>Cuenta conectada</small></div><i className="online"/></div>
      <p className="overline">ESPACIO DE TRABAJO</p>
      <nav>{nav.map(({label, icon: Icon}) => <button key={label} onClick={() => {setSection(label);setMenuOpen(false)}} className={section === label ? 'nav active' : 'nav'}><Icon size={18}/>{label}{label === 'Mensajes' && conversations.length > 0 && <em>{conversations.length}</em>}</button>)}</nav>
      <div className="side-bottom"><div className="promo"><Sparkles size={17}/><b>Tu mundo, conectado</b><p>Todo lo que necesitas para comunicarte, en un solo lugar.</p></div><button className="nav"><Settings size={18}/>Configuración</button><button className="nav signout" onClick={signOut}><LogOut size={18}/>Cerrar sesión</button><small className="privacy"><ShieldCheck size={14}/> Privacidad primero</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}>☰</button><div><small className="overline">TU ESPACIO PERSONAL</small><h1>{section}</h1></div><div className="top-right"><span className="connection"><i/> Cuenta conectada</span><button className="bell" aria-label="Notificaciones"><Bell size={19}/></button><div className="avatar user small">{initial}</div></div></header>
      {section === 'Mensajes' ? <div className={`messenger ${selected ? 'has-selected' : ''}`}>
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
            <div className="conversation-head"><button className="mobile-back" onClick={() => setSelected(null)} aria-label="Volver a conversaciones"><ArrowLeft size={18}/></button><div className="avatar violet">{initials(selected.other_display_name)}</div><div className="person"><b>{selected.other_display_name}</b><small>@{selected.other_username}</small></div><div className="actions"><button aria-label="Llamada" title="Próximamente"><Phone size={18}/></button><button aria-label="Videollamada" title="Próximamente"><Video size={19}/></button><button aria-label="Más opciones"><MoreVertical size={19}/></button></div></div>
            <div className="messages">
              <div className="day">MENSAJES DE VOXLY</div>
              {loadingMessages ? <p className="empty-messages">Cargando mensajes...</p> : messages.length ? messages.map(message => <div key={message.id} className={message.sender_id === session.user.id ? 'message outgoing' : 'message incoming'}><div className="bubble">{message.message_type === 'image' && message.attachment_signed_url ? <a href={message.attachment_signed_url} target="_blank" rel="noreferrer"><img className="message-image" src={message.attachment_signed_url} alt={message.content} loading="lazy"/></a> : message.attachment_signed_url ? <a className="message-file" href={message.attachment_signed_url} target="_blank" rel="noreferrer">📎 {message.content}</a> : message.attachment_url ? <span>📎 {message.content}</span> : message.content}</div><time>{shortTime(message.created_at)}</time></div>) : <div className="empty-messages"><MessageCircle size={27}/><b>Esta conversación está lista</b><span>Envía el primer mensaje para comenzar.</span></div>}
            </div>
            <form className="composer" onSubmit={sendMessage}><input ref={fileInputRef} className="hidden-file-input" type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.xlsx,.pptx" onChange={e => uploadAttachment(e.target.files?.[0])}/><button type="button" aria-label="Adjuntar archivo" title="Adjuntar archivo (máx. 15 MB)" disabled={uploading} onClick={() => fileInputRef.current?.click()}><Paperclip size={18}/></button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={`Escribe un mensaje a ${selected.other_display_name}...`}/><button type="button" aria-label="Enviar fotografía" title="Enviar fotografía" disabled={uploading} onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click() } }}><Image size={18}/></button><button type="button" aria-label="Audio" title="Grabación de audio: próximamente"><Mic size={18}/></button><button className="send" type="submit" disabled={!draft.trim() || sending} aria-label="Enviar"><Send size={17}/></button></form>
            <p className="hint">{uploading ? 'Subiendo archivo…' : 'Tus mensajes se guardan en Supabase y se actualizan en tiempo real.'}</p>
          </> : <div className="empty-conversation"><MessageCircle size={42}/><h2>Tu espacio de conversación</h2><p>Selecciona un chat o pulsa + para encontrar personas en Voxly.</p></div>}
        </section>
      </div> : <div className="placeholder"><div className="placeholder-icon">{section === 'Contactos' ? <Users/> : section === 'Grupos' ? <UsersRound/> : section === 'Llamadas' ? <Phone/> : <Bot/>}</div><h2>{section}</h2><p>Esta sección se implementará en las siguientes etapas.</p><span><Sparkles size={14}/> Próximamente en Voxly</span></div>}
      {error && <div className="app-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
    </section>
  </main>
}
