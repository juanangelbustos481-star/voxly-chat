# Voxly

Aplicación de mensajería original para Android y Windows.

## Requisitos
- Node.js 20 o superior
- npm
- Android Studio para compilar Android
- Windows para generar el instalador Windows

## Desarrollo web
```bash
npm install
npm run dev
```

## Supabase
1. Crea un proyecto en https://supabase.com/dashboard.
2. Copia `.env.example` como `.env.local`.
3. Agrega la URL del proyecto y la clave pública anon/publishable.
4. Reinicia `npm run dev`.

Nunca agregues la clave `service_role` al frontend. La conexión está preparada, pero
la autenticación y la persistencia se implementarán en la etapa 2. Los chats iniciales
son demostrativos; el formulario no transmite mensajes reales todavía.

## Android
```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## Windows
```bash
npm run build
npm run desktop:build
```
Para desarrollo de escritorio, ejecuta `npm run dev` y `npm run desktop:dev`
en terminales separadas.

## Etapas
1. Identidad, diseño y arquitectura.
2. Autenticación, perfiles y contactos.
3. Mensajería en tiempo real.
4. Multimedia y notas de voz.
5. Grupos.
6. Voz y videollamadas.
7. Asistente IA.
8. Notificaciones.
9. Seguridad y pruebas.
10. Empaquetado y publicación.

## Estado
La etapa 1 incluye estructura React/TypeScript, interfaz responsive inicial,
configuración base de Supabase, Capacitor y Electron. La interfaz todavía es una
vista previa: los mensajes, llamadas y notificaciones reales se implementarán después.
