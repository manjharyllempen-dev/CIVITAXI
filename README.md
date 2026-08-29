# Nova Taxi

Aplicación Android/PWA para servicio de taxi en Perú con tres APK independientes.

## APK

- `usuarioDebug` → Nova Taxi Pasajero
- `choferDebug` → Nova Taxi Conductor
- `adminDebug` → Nova Taxi Administrador

Cada aplicación abre directamente su perfil:

- Pasajero: solicitar viaje, proponer tarifa y avisar pago en efectivo o Yape.
- Conductor: disponibilidad, solicitudes, viajes y membresía.
- Administración: control operativo y precios manuales de membresía semanal o mensual.

## Compilación automática

GitHub Actions ejecuta `.github/workflows/android-build.yml` y publica:

- `NovaTaxi-Pasajero.apk`
- `NovaTaxi-Conductor.apk`
- `NovaTaxi-Administrador.apk`
- `NovaTaxi-APK-Pack` con los tres APK y sus verificaciones SHA-256.

Abra la pestaña **Actions**, seleccione la ejecución más reciente y descargue los archivos desde **Artifacts**.
