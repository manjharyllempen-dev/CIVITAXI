# CiviTaxi

Aplicación Android/PWA para servicio de taxi con tres perfiles dentro de un solo proyecto Android.

## Variantes Android

- `usuarioDebug` → CiviTaxi Usuario
- `choferDebug` → CiviTaxi Chofer
- `adminDebug` → CiviTaxi Administrador

IDs de aplicación:

- `com.civitaxi.app.usuario`
- `com.civitaxi.app.chofer`
- `com.civitaxi.app.admin`

## Backend

El proyecto usa Supabase para autenticación, perfiles, choferes, vehículos, viajes, ubicaciones, compartir viaje, calificaciones, incidencias y tarifas.

## Compilar localmente

Con Android Studio abierto en este repositorio, usar Gradle con JDK 17 y ejecutar:

```powershell
gradle :app:assembleUsuarioDebug :app:assembleChoferDebug :app:assembleAdminDebug
```

Los APK se generan bajo `app/build/outputs/apk/<perfil>/debug/`.

## GitHub Actions

El workflow `.github/workflows/android-build.yml` compila automáticamente las tres APK y las publica como artifacts descargables.

## Diseño

Identidad principal: fondo fucsia `#E6007E`, botones fucsia oscuro y textos blancos.
