import { useState } from 'react'
import { Bot, Image, MessageCircle, Mic, MoreVertical, Paperclip, Phone, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Users, UsersRound, Video, Bell } from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabase'

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

export default function App() {
  const [section, setSection] = useState('Mensajes')
  const [selected, setSelected] = useState(chats[0])
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  return <main className="shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-icon">V</div><div><b>voxly</b><small>CONNECT WITHOUT LIMITS</small></div><button className="close-menu" onClick={() => setMenuOpen(false)}>×</button></div>
      <div className="account"><div className="avatar user">T</div><div><b>Tu perfil</b><small>Disponible</small></div><i className="online"/></div>
      <p className="overline">ESPACIO DE TRABAJO</p>
      <nav>{nav.map(({label, icon: Icon}) => <button key={label} onClick={() => {setSection(label);setMenuOpen(false)}} className={section === label ? 'nav active' : 'nav'}><Icon size={18}/>{label}{label === 'Mensajes' && <em>2</em>}</button>)}</nav>
      <div className="side-bottom"><div className="promo"><Sparkles size={17}/><b>Tu mundo, conectado</b><p>Todo lo que necesitas para comunicarte, en un solo lugar.</p></div><button className="nav"><Settings size={18}/>Configuración</button><small className="privacy"><ShieldCheck size={14}/> Privacidad primero</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}>☰</button><div><small className="overline">TU ESPACIO PERSONAL</small><h1>{section}</h1></div><div className="top-right"><span className="connection"><i/> {isSupabaseConfigured ? 'Supabase configurado' : 'Vista previa'}</span><button className="bell" aria-label="Notificaciones"><Bell size={19}/></button><div className="avatar user small">T</div></div></header>
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
