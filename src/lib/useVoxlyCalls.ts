import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

type CallType = 'audio' | 'video'
type CallRow = {
  id: string
  conversation_id: string
  caller_id: string
  callee_id: string
  call_type: CallType
  status: 'ringing' | 'accepted' | 'declined' | 'ended'
}
type SignalRow = {
  id: string
  call_id: string
  sender_id: string
  target_id: string
  signal_type: 'offer' | 'answer' | 'ice'
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit
}
export type VoxlyCall = CallRow

export function useVoxlyCalls(client: SupabaseClient | null, session: Session | null) {
  const [call, setCall] = useState<CallRow | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallRow | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [callError, setCallError] = useState('')
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const remoteRef = useRef<MediaStream | null>(null)
  const currentCallRef = useRef<CallRow | null>(null)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const handledSignalsRef = useRef<Set<string>>(new Set())

  const closeMedia = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localRef.current?.getTracks().forEach(track => track.stop())
    localRef.current = null
    remoteRef.current = null
    pendingIceRef.current = []
    handledSignalsRef.current.clear()
    setLocalStream(null)
    setRemoteStream(null)
    setMuted(false)
    setCameraOff(false)
  }, [])

  const insertSignal = useCallback(async (row: CallRow, signalType: SignalRow['signal_type'], payload: SignalRow['payload']) => {
    if (!client || !session) return
    const targetId = row.caller_id === session.user.id ? row.callee_id : row.caller_id
    const { error } = await client.from('voxly_call_signals').insert({
      call_id: row.id, sender_id: session.user.id, target_id: targetId,
      signal_type: signalType, payload
    })
    if (error) throw error
  }, [client, session])

  const makePeer = useCallback((row: CallRow, stream: MediaStream) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    pcRef.current = peer
    stream.getTracks().forEach(track => peer.addTrack(track, stream))
    peer.ontrack = event => {
      const incoming = event.streams[0]
      if (incoming) {
        remoteRef.current = incoming
        setRemoteStream(incoming)
      }
    }
    peer.onicecandidate = event => {
      if (event.candidate) void insertSignal(row, 'ice', event.candidate.toJSON()).catch(err => {
        setCallError(err instanceof Error ? err.message : 'No se pudo enviar la señal de conexión.')
      })
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') {
        setCallError('No se pudo establecer la conexión. Comprueba tu red e inténtalo de nuevo.')
      }
    }
    return peer
  }, [insertSignal])

  const applySignal = useCallback(async (signal: SignalRow) => {
    const peer = pcRef.current
    if (!peer || handledSignalsRef.current.has(signal.id)) return
    handledSignalsRef.current.add(signal.id)
    try {
      if (signal.signal_type === 'answer' && signal.payload && 'type' in signal.payload) {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))
        for (const candidate of pendingIceRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate))
      } else if (signal.signal_type === 'ice' && signal.payload && 'candidate' in signal.payload) {
        const candidate = signal.payload as RTCIceCandidateInit
        if (peer.remoteDescription) await peer.addIceCandidate(new RTCIceCandidate(candidate))
        else pendingIceRef.current.push(candidate)
      }
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Error al conectar la llamada.')
    }
  }, [])

  useEffect(() => {
    if (!client || !session) return
    const userId = session.user.id
    const channel = client.channel('voxly-calls-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voxly_call_sessions' }, payload => {
        const row = (payload.new || payload.old) as CallRow
        if (!row?.id) return
        if (row.callee_id === userId && row.caller_id !== userId && row.status === 'ringing') {
          setIncomingCall(row)
        }
        if (currentCallRef.current?.id === row.id && ['ended', 'declined'].includes(row.status)) {
          currentCallRef.current = null
          setCall(null)
          setIncomingCall(null)
          closeMedia()
        }
        if (incomingCall?.id === row.id && ['ended', 'declined'].includes(row.status)) setIncomingCall(null)
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'voxly_call_signals',
        filter: 'target_id=eq.' + userId
      }, payload => {
        const signal = payload.new as SignalRow
        void applySignal(signal)
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [client, session?.user.id, closeMedia, applySignal, incomingCall?.id])

  useEffect(() => {
    currentCallRef.current = call
  }, [call])

  const startCall = useCallback(async (conversationId: string, calleeId: string | null, callType: CallType) => {
    if (!client || !session || !calleeId) {
      setCallError('Las llamadas están disponibles en conversaciones individuales.')
      return
    }
    if (call || incomingCall) return
    setCallError('')
    try {
      const { data, error } = await client.from('voxly_call_sessions').insert({
        conversation_id: conversationId, caller_id: session.user.id,
        callee_id: calleeId, call_type: callType, status: 'ringing'
      }).select('*').single()
      if (error) throw error
      const row = data as CallRow
      currentCallRef.current = row
      setCall(row)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, video: callType === 'video'
      })
      localRef.current = stream
      setLocalStream(stream)
      const peer = makePeer(row, stream)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await insertSignal(row, 'offer', offer)
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'No se pudo iniciar la llamada. Revisa los permisos de cámara y micrófono.')
      const row = currentCallRef.current
      if (row && client) await client.from('voxly_call_sessions').update({ status: 'ended' }).eq('id', row.id)
      currentCallRef.current = null
      setCall(null)
      closeMedia()
    }
  }, [client, session, call, incomingCall, makePeer, insertSignal, closeMedia])

  const acceptCall = useCallback(async () => {
    if (!client || !session || !incomingCall) return
    const row = incomingCall
    setCallError('')
    try {
      const { data: offers, error } = await client.from('voxly_call_signals')
        .select('*').eq('call_id', row.id).eq('signal_type', 'offer')
        .order('created_at', { ascending: true }).limit(1)
      if (error) throw error
      const offer = (offers || [])[0] as SignalRow | undefined
      if (!offer) throw new Error('La invitación ya no está disponible. Pide que vuelvan a llamar.')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, video: row.call_type === 'video'
      })
      localRef.current = stream
      setLocalStream(stream)
      const peer = makePeer(row, stream)
      await peer.setRemoteDescription(new RTCSessionDescription(offer.payload as RTCSessionDescriptionInit))
      for (const candidate of pendingIceRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate))
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      await insertSignal(row, 'answer', answer)
      const { error: updateError } = await client.from('voxly_call_sessions').update({ status: 'accepted' }).eq('id', row.id)
      if (updateError) throw updateError
      currentCallRef.current = row
      setCall({ ...row, status: 'accepted' })
      setIncomingCall(null)
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'No se pudo aceptar la llamada.')
      closeMedia()
    }
  }, [client, session, incomingCall, makePeer, insertSignal, closeMedia])

  const rejectCall = useCallback(async () => {
    if (!client || !incomingCall) return
    await client.from('voxly_call_sessions').update({ status: 'declined' }).eq('id', incomingCall.id)
    setIncomingCall(null)
  }, [client, incomingCall])

  const endCall = useCallback(async () => {
    const row = currentCallRef.current || call
    if (row && client) await client.from('voxly_call_sessions').update({ status: 'ended' }).eq('id', row.id)
    currentCallRef.current = null
    setCall(null)
    setIncomingCall(null)
    closeMedia()
  }, [client, call, closeMedia])

  const toggleMute = useCallback(() => {
    const next = !muted
    localRef.current?.getAudioTracks().forEach(track => { track.enabled = !next })
    setMuted(next)
  }, [muted])

  const toggleCamera = useCallback(() => {
    const next = !cameraOff
    localRef.current?.getVideoTracks().forEach(track => { track.enabled = !next })
    setCameraOff(next)
  }, [cameraOff])

  useEffect(() => () => closeMedia(), [closeMedia])

  return { call, incomingCall, localStream, remoteStream, muted, cameraOff, callError,
    startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera,
    clearCallError: () => setCallError('') }
}
