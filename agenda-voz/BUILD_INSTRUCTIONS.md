# 📱 Agenda Voz — Instrucciones para generar el APK

## Qué es esta app

**Agenda Voz** es una app Android que te permite:
- ✅ Crear recordatorios con tu **propia voz grabada**
- ✅ Programar por **día de la semana** y horario exacto
- ✅ La alarma se **repite cada N minutos** hasta que presionás **ENTENDIDO**
- ✅ Dictado por voz para escribir el nombre del recordatorio
- ✅ Funciona completamente **sin internet**

---

## Opción 1: Compilar en la nube (RECOMENDADO — Gratis)

### Paso 1 — Instalar herramientas
```bash
# Instalar Node.js (https://nodejs.org) si no lo tenés
# Luego:
npm install -g expo-cli eas-cli
```

### Paso 2 — Crear cuenta Expo (gratis)
Registrate en: https://expo.dev/signup

### Paso 3 — Instalar dependencias
```bash
cd agenda-voz
npm install
```

### Paso 4 — Login
```bash
eas login
```

### Paso 5 — Compilar APK (tarda ~10-15 minutos en la nube)
```bash
eas build -p android --profile preview
```

Al terminar te dará un link para **descargar el APK directamente**. Instalalo en tu Android.

---

## Opción 2: Compilar local (requiere Android Studio)

### Requisitos
- Android Studio instalado
- Java JDK 17
- Variables de entorno JAVA_HOME y ANDROID_HOME configuradas

### Pasos
```bash
cd agenda-voz
npm install
npx expo run:android --variant release
```

El APK queda en: `android/app/build/outputs/apk/release/app-release.apk`

---

## Instalar en el teléfono

1. Transferí el APK al teléfono (USB, WhatsApp, Google Drive, etc.)
2. Abrilo desde el teléfono
3. Si pide permiso para "Instalar de fuentes desconocidas" → **Permitir**
4. Instalá y abrí la app

---

## Permisos que solicita la app

| Permiso | Para qué |
|---------|----------|
| Micrófono | Grabar tu voz para los recordatorios |
| Notificaciones | Mostrarte las alertas |
| Vibración | Vibrar cuando suena la alarma |
| Iniciar en arranque | (Futuro) Restaurar alarmas al reiniciar |

---

## Cómo usar la app

1. **Nueva alarma** → Tocá el botón **+**
2. **Ponele nombre** (escribí o usá el teclado por voz de Android)
3. **Elegí los días** de la semana que debe sonar
4. **Configurá la hora** con los selectores
5. **Elegí cada cuántos minutos** se repite si no confirmás
6. **Grabá tu voz**: tocá "Grabar mi voz" → hablá → tocá "Detener"
7. Tocá **Guardar**
8. Activá/desactivá con el switch de cada recordatorio

### Cuando suena la alarma:
- La app se abre con pantalla roja/morada pulsante
- Tu voz se reproduce automáticamente
- Muestra un countdown de cuándo se repite
- Presioná el botón verde **ENTENDIDO** para apagar

---

## Soporte de reconocimiento de voz

La app usa el **micrófono del teclado de Android** para dictado de texto.
Para hacerlo, cuando estés en el campo de texto del nombre:
1. Abrí el teclado
2. Tocá el ícono del micrófono en tu teclado (Gboard, Samsung, etc.)
3. Dictá el nombre del recordatorio

---

## Problemas comunes

**La alarma no suena cuando la app está cerrada:**
→ Android restringe las apps en segundo plano. Asegurate de:
- Ir a Ajustes → Apps → Agenda Voz → Batería → "Sin restricciones"
- Desactivar la optimización de batería para esta app
- En algunos teléfonos: Ajustes → Apps → Agenda Voz → "Permitir inicio automático"

**Las alarmas dejaron de funcionar:**
→ Abrí la app → ⚙️ Configuración → "Reconstruir alarmas"

---

## Estructura del proyecto

```
agenda-voz/
├── App.js                    ← Entrada principal, navegación, listeners de notificación
├── src/
│   ├── theme.js              ← Colores y estilos globales
│   ├── screens/
│   │   ├── HomeScreen.js     ← Lista de recordatorios
│   │   ├── AddEditScreen.js  ← Crear/editar recordatorio + grabar voz
│   │   ├── AlertScreen.js    ← Pantalla de alarma con botón ENTENDIDO
│   │   └── SettingsScreen.js ← Configuración
│   └── utils/
│       ├── storage.js        ← Guardar datos localmente
│       └── alarmManager.js   ← Gestión de notificaciones y alarmas
├── package.json
├── app.json                  ← Config de Expo
└── eas.json                  ← Config de build en la nube
```
