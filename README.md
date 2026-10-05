# Nova Taxi

Aplicación Android/PWA para servicios de movilidad en Perú con tres APK independientes.

Versión actual: **0.29.1** (`versionCode 38`).

## APK

- `usuarioDebug` → Nova Taxi Pasajero
- `choferDebug` → Nova Taxi Conductor
- `adminDebug` → Nova Taxi Administrador

Cada aplicación abre directamente su perfil:

- Pasajero: elegir un servicio activo (taxi, mototaxi, flete, bicicleta u otro), solicitar viaje y avisar pago en efectivo o Yape.
- Conductor: registro como Auto, Mototaxi, Bicicleta, Flete u otro servicio activo; recibe únicamente solicitudes de ese mismo servicio.
- Administración: crear, editar, activar, ocultar y eliminar servicios, además de definir si requieren placa, licencia y SOAT; gestionar tarifas, usuarios, choferes y archivos diarios.

## Catálogo de servicios

La migración `20261001041525_nova_taxi_service_catalog.sql` crea el catálogo dinámico en Supabase. Las migraciones `20261001053210_driver_service_matching.sql` y `20261001061500_public_service_catalog.sql` asignan un servicio a cada chofer, permiten elegirlo antes del registro y aplican reglas RLS para que solo vea y acepte viajes del mismo tipo. Solo los administradores pueden modificar el catálogo. Cada viaje conserva una copia del nombre y el icono del servicio elegido.

## Compilación automática

GitHub Actions ejecuta `.github/workflows/android-build.yml` y publica:

- `NovaTaxi-Pasajero.apk`
- `NovaTaxi-Conductor.apk`
- `NovaTaxi-Administrador.apk`
- `NovaTaxi-APK-Pack` con los tres APK y sus verificaciones SHA-256.

Abra la pestaña **Actions**, seleccione la ejecución más reciente y descargue los archivos desde **Artifacts**.
