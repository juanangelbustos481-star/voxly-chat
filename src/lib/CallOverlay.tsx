import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff, Phone } from 'lucide-react'
import type { VoxlyCall } from './useVoxlyCalls'

type Props = {
  call: VoxlyCall | null
  incomingCall: VoxlyCall | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  muted: boolean
  cameraOff: boolean
  peerName: string
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
  onMute: () => void
  onCamera: () => void
}

export default function CallOverlay(props: Props) {
  const localVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const remoteAudio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = props.localStream
    if (remoteVideo.current) remoteVideo.current.srcObject = props.remoteStream
    if (remoteAudio.current) remoteAudio.current.srcObject = props.remoteStream
  }, [props.localStream, props.remoteStream])

  if (props.incomingCall && !props.call) {
    return <div className="call-overlay"><section className="incoming-call-card">
      <div className="call-avatar"><Phone size={28}/></div>
      <span className="call-kicker">LLAMADA ENTRANTE</span>
      <h2>{props.peerName}</h2>
      <p>{props.incomingCall.call_type === 'video' ? 'Videollamada' : 'Llamada de voz'}</p>
      <div className="incoming-actions"><button className="call-accept" onClick={props.onAccept}>Aceptar</button><button className="call-reject" onClick={props.onReject}>Rechazar</button></div>
    </section></div>
  }

  if (!props.call) return null
  const videoCall = props.call.call_type === 'video'
  return <div className={videoCall ? 'call-overlay video-call-overlay' : 'call-overlay'}>
    <section className={videoCall ? 'active-call-card video-call-card' : 'active-call-card'}>
      {videoCall && <div className="call-video-stage">
        <video ref={remoteVideo} autoPlay playsInline className="remote-video"/>
        <video ref={localVideo} autoPlay muted playsInline className="local-video"/>
        {!props.remoteStream && <div className="video-waiting"><div className="call-avatar"><Video size={26}/></div><b>Esperando respuesta...</b></div>}
        {props.cameraOff && <span className="camera-status">Cámara apagada</span>}
      </div>}
      {!videoCall && <div className="call-avatar active"><Phone size={30}/></div>}
      <span className="call-kicker">{props.call.status === 'accepted' ? 'EN LLAMADA' : 'CONECTANDO'}</span>
      <h2>{props.peerName}</h2>
      <p>{props.call.status === 'accepted' ? 'Conexión activa' : 'Llamando…'}</p>
      {!videoCall && <audio ref={remoteAudio} autoPlay/>}
      <div className="call-controls">
        <button className={props.muted ? 'call-control selected' : 'call-control'} onClick={props.onMute} aria-label={props.muted ? 'Activar micrófono' : 'Silenciar micrófono'}>{props.muted ? <MicOff/> : <Mic/>}</button>
        {videoCall && <button className={props.cameraOff ? 'call-control selected' : 'call-control'} onClick={props.onCamera} aria-label={props.cameraOff ? 'Activar cámara' : 'Apagar cámara'}>{props.cameraOff ? <VideoOff/> : <Video/>}</button>}
        <button className="call-control hangup" onClick={props.onEnd} aria-label="Finalizar llamada"><PhoneOff/></button>
      </div>
    </section>
  </div>
}
