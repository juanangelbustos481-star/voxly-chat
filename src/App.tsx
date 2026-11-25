import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Bot, Image, LogOut, MessageCircle, Mic, MoreVertical, Paperclip, Phone, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, UsersRound, Video, Bell, LockKeyhole, Mail, UserRound, Eye, EyeOff } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const chats = [
  { id: 1, name: 'Sofía Martínez', text: '¡Nos vemos más tarde!', time: '10:42', unread: 2, initials: 'SM', tone: 'violet', online: true },
  { id: 2, name: 'Equipo Creativo', text: 'Alex: Ya quedó el diseño', time: '09:18', unread: 5, initials: 'EC', tone: 'blue' },
  { id: 3, name: 'Daniel', text: 'Te envié las fotos 📷', time: 'Ayer', initials: 'DA', tone: 'pink', online: true },
  { id: 4, name: 'Familia', text: 'Mamá: Buen día a todos', time: 'Ayer', initials: 'FA', tone: 'orange' },
  { id: 5, name: 'Valeria', text: 'Gracias!! 💜', time: 'Lun', initials: 'VA', tone: 'green' }
]
const nav = [
  { label: 'Mensajes', icon: MessageCircle }, { label: 'Contactos', icon: Users },
  { label: 'Grupos', icon: UsersRound }, { label: 'Llamadas', icon: Phone }, { label: 'Voxly AI', icon: Bot }
]

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
        if (data.session) {
          setNotice('Tu cuenta está lista. Bienvenido a Voxly.')
        } else {
          setNotice('Cuenta creada. Revisa tu correo para confirmar el registro y después inicia sesión.')
          setMode('login')
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })
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
  const [selected, setSelected] = useState(chats[0])
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

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

  if (!isSupabaseConfigured || !supabase) {
    return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div></div><h1>Falta configurar Supabase</h1><p className="auth-subtitle">Comprueba las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el entorno de Codespaces y reinicia el servidor.</p></section></main>
  }
  if (authLoading) return <main className="auth-screen"><div className="auth-loading"><div className="brand-icon">V</div><p>Preparando tu espacio Voxly...</p></div></main>
  if (!session) return <AuthScreen />

  const displayName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Tu perfil'
  const initial = String(displayName).trim().charAt(0).toUpperCase() || 'V'

  async function signOut() {
    const { error } = await supabase!.auth.signOut()
    if (error) window.alert('No se pudo cerrar sesión: ' + error.message)
  }

  return <main className="shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div><button className="close-menu" onClick={() => setMenuOpen(false)}>×</button></div>
      <div className="account"><div className="avatar user">{initial}</div><div><b>{displayName}</b><small>Cuenta conectada</small></div><i className="online"/></div>
      <p className="overline">ESPACIO DE TRABAJO</p>
      <nav>{nav.map(({label, icon: Icon}) => <button key={label} onClick={() => {setSection(label);setMenuOpen(false)}} className={section === label ? 'nav active' : 'nav'}><Icon size={18}/>{label}{label === 'Mensajes' && <em>2</em>}</button>)}</nav>
      <div className="side-bottom"><div className="promo"><Sparkles size={17}/><b>Tu mundo, conectado</b><p>Todo lo que necesitas para comunicarte, en un solo lugar.</p></div><button className="nav"><Settings size={18}/>Configuración</button><button className="nav signout" onClick={signOut}><LogOut size={18}/>Cerrar sesión</button><small className="privacy"><ShieldCheck size={14}/> Privacidad primero</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}>☰</button><div><small className="overline">TU ESPACIO PERSONAL</small><h1>{section}</h1></div><div className="top-right"><span className="connection"><i/> Cuenta conectada</span><button className="bell" aria-label="Notificaciones"><Bell size={19}/></button><div className="avatar user small">{initial}</div></div></header>
      {section === 'Mensajes' ? <div className="messenger">
        <aside className="chat-list"><div className="list-heading"><div><h2>Conversaciones</h2><p>Tu gente, siempre cerca.</p></div><button className="add" aria-label="Nuevo chat"><Plus size={18}/></button></div>
          <label className="search"><Search size={16}/><input placeholder="Buscar conversaciones..."/></label>
          <div className="filters"><button className="chosen">Todos</button><button>No leídos</button><button>Grupos</button></div>
          {chats.map(chat => <button key={chat.id} onClick={() => setSelected(chat)} className={selected.id === chat.id ? 'chat selected' : 'chat'}><div className={`avatar ${chat.tone}`}>{chat.initials}{chat.online && <i className="online"/>}</div><div className="chat-info"><div className="chat-title"><b>{chat.name}</b><time>{chat.time}</time></div><div className="chat-text"><span>{chat.text}</span>{chat.unread && <em>{chat.unread}</em>}</div></div></button>)}
          <div className="list-foot">Voxly está listo para conectar <i/></div>
        </aside>
        <section className="conversation"><div className="conversation-head"><div className={`avatar ${selected.tone}`}>{selected.initials}</div><div className="person"><b>{selected.name}</b><small>{selected.online ? 'En línea ahora' : 'Última vez recientemente'}</small></div><div className="actions"><button aria-label="Llamada"><Phone size={18}/></button><button aria-label="Videollamada"><Video size={19}/></button><button aria-label="Más opciones"><MoreVertical size={19}/></button></div></div>
          <div className="messages"><div className="day">HOY · DEMOSTRACIÓN</div><div className="message incoming"><div className="bubble">¡Hola! ¿Cómo va todo?</div><time>10:38</time></div><div className="message outgoing"><div className="bubble">¡Todo muy bien! Estoy probando Voxly ✨</div><time>10:40 · Demostración</time></div><div className="message incoming"><div className="bubble">¡Qué genial! Me cuentas cómo funciona.</div><time>10:41</time></div><div className="message incoming"><div className="bubble">¡Nos vemos más tarde!</div><time>10:42</time></div><div className="secure-note"><ShieldCheck size={13}/> La protección de conversaciones se configurará en próximas etapas.</div></div>
          <form className="composer" onSubmit={e => {e.preventDefault();setDraft('')}}><button type="button" aria-label="Adjuntar"><Paperclip size={18}/></button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={`Escribe un mensaje a ${selected.name}...`}/><button type="button" aria-label="Fotografía"><Image size={18}/></button><button type="button" aria-label="Audio"><Mic size={18}/></button><button className="send" disabled={!draft.trim()} aria-label="Enviar"><Send size={17}/></button></form>
          <p className="hint">Interfaz de demostración: los mensajes todavía no se envían.</p>
        </section>
      </div> : <div className="placeholder"><div className="placeholder-icon">{section === 'Contactos' ? <Users/> : section === 'Grupos' ? <UsersRound/> : section === 'Llamadas' ? <Phone/> : <Bot/>}</div><h2>{section}</h2><p>Esta sección se implementará en las siguientes etapas.</p><span><Sparkles size={14}/> Próximamente en Voxly</span></div>}
    </section>
  </main>
}
