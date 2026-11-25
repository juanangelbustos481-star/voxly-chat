# Configurar notificaciones push de Voxly

Esta etapa agrega notificaciones push para la versión web/PWA de Voxly en navegadores compatibles (por ejemplo, Chrome y Edge). No activa todavía notificaciones nativas de una futura APK Android empaquetada con Capacitor.

## 1. Crear las claves VAPID

En la terminal de Codespaces ejecuta:

```bash
npx --yes web-push generate-vapid-keys
```

Guarda las dos claves en un lugar privado. La clave privada nunca debe colocarse en el frontend, en GitHub ni en el chat.

## 2. Configurar la clave pública en Codespaces

En los secretos del entorno de Codespaces agrega:

- Nombre: `VITE_VAPID_PUBLIC_KEY`
- Valor: la clave pública VAPID generada.

Reinicia el servidor de desarrollo después de cambiar secretos.

## 3. Preparar Supabase

En Supabase → SQL Editor, ejecuta el archivo completo:

`supabase/push_setup.sql`

Esto crea una tabla privada para las suscripciones y funciones RPC protegidas. Cada usuario solo puede registrar o quitar la suscripción de su propio dispositivo.

## 4. Guardar secretos del servidor y desplegar la función

En Codespaces, inicia sesión y vincula el proyecto (si todavía no lo has hecho):

```bash
npx supabase login
npx supabase link --project-ref hnauwuqzdxtdddtxuzpy
```

Crea un secreto aleatorio para el webhook. Puedes generarlo con:

```bash
openssl rand -hex 32
```

No lo publiques ni lo envíes por chat. Configura los secretos del servidor (sustituye los valores entre corchetes por los tuyos):

```bash
npx supabase secrets set VAPID_PUBLIC_KEY="[CLAVE_PUBLICA]"
npx supabase secrets set VAPID_PRIVATE_KEY="[CLAVE_PRIVADA]"
npx supabase secrets set VAPID_SUBJECT="mailto:tu-correo-de-contacto"
npx supabase secrets set VOXLY_WEBHOOK_SECRET="[SECRETO_ALEATORIO]"
```

Despliega la función:

```bash
npx supabase functions deploy notify-new-message --no-verify-jwt
```

La función valida el encabezado secreto del webhook y usa la clave de servicio únicamente en el servidor. No agregues la clave `service_role` a variables `VITE_*` ni al código del navegador.

## 5. Crear el webhook de mensajes

En el panel de Supabase abre **Database → Webhooks** y crea un webhook con estos datos:

- Nombre: `voxly_new_message_push`
- Tabla: `public.messages`
- Evento: solo `INSERT`
- Método: `POST`
- URL: `https://hnauwuqzdxtdddtxuzpy.supabase.co/functions/v1/notify-new-message`
- Encabezado: `Content-Type: application/json`
- Encabezado: `x-voxly-webhook-secret: [EL_MISMO_SECRETO_ALEATORIO]`

El secreto del encabezado debe coincidir exactamente con `VOXLY_WEBHOOK_SECRET`. Guarda el webhook.

## 6. Actualizar y probar Voxly

```bash
git pull origin main
npm run build
npm run dev
```

Abre Voxly desde una dirección HTTPS, inicia sesión, abre la campana de notificaciones y pulsa **Activar notificaciones aunque Voxly esté cerrado**. Acepta el permiso del navegador.

Después, desde otra cuenta, envía un mensaje. Prueba primero con Voxly en segundo plano y luego cierra la pestaña o ventana. Para una prueba fiable en Android, instala la PWA desde Chrome y permite las notificaciones.

## Notas importantes

- La entrega depende del navegador, permisos del dispositivo, conexión a internet y políticas de ahorro de batería.
- En Android, las notificaciones push web funcionan en navegadores compatibles y PWA instalada. Una APK nativa con Capacitor necesitará integración nativa de FCM en otra etapa.
- El texto de la notificación no muestra el contenido privado del mensaje; solo indica que llegó un mensaje, fotografía, nota de voz o archivo.
- Si cambias de navegador o dispositivo, activa las notificaciones en cada uno.
