import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Registrar el Service Worker de Voxly
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => {
        console.log('Voxly: Service Worker registrado correctamente')
      })
      .catch((error) => {
        console.error('Error al registrar el Service Worker:', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)