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

## Conectar Supabase
1. En Supabase, abre tu proyecto y entra a **Project Settings > API Keys**.
2. Copia la **Project URL** y la clave **Publishable** (empieza por `sb_publishable_`).
3. Crea un archivo local llamado `.env.local` a partir de `.env.example`.
4. Coloca los valores en `.env.local` y reinicia `npm run dev`.
5. En Supabase abre **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecuta el script.

Usa la URL base del proyecto (por ejemplo, `https://xxxx.supabase.co`), no agregues `/rest/v1/`.
Nunca pongas una clave `secret` o `service_role` en el frontend ni la subas a GitHub.
La clave Publishable sí está diseñada para usarse en el cliente; la seguridad de los datos
se controla con las políticas RLS del esquema.

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
2. Base de datos y autenticación.
3. Mensajería en tiempo real.
4. Multimedia y notas de voz.
5. Grupos.
6. Voz y videollamadas.
7. Asistente IA.
8. Notificaciones.
9. Seguridad y pruebas.
10. Empaquetado y publicación.

## Estado
La interfaz inicial y la estructura React/TypeScript, Supabase, Capacitor y Electron están
preparadas. El esquema inicial de Supabase incluye perfiles, contactos, conversaciones,
miembros y mensajes con RLS. La conexión todavía debe configurarse en el entorno local
y probarse; los chats de la interfaz siguen siendo demostrativos hasta implementar la
autenticación y el envío/recepción real de mensajes.
