#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Uso: $0 PASAJERO.apk CONDUCTOR.apk ADMINISTRADOR.apk" >&2
  exit 2
fi

passenger_apk="$1"
driver_apk="$2"
admin_apk="$3"

verify_package() {
  apk_path="$1"
  expected_package="$2"

  if [ ! -f "$apk_path" ]; then
    echo "No existe: $apk_path" >&2
    exit 1
  fi

  if ! unzip -p "$apk_path" AndroidManifest.xml \
    | strings -el \
    | grep -Fxq "$expected_package"; then
    echo "La APK $apk_path no contiene el paquete esperado $expected_package" >&2
    exit 1
  fi
}

verify_package "$passenger_apk" "com.novataxi.app.pasajero"
verify_package "$driver_apk" "com.novataxi.app.conductor"
verify_package "$admin_apk" "com.novataxi.app.administrador"

unique_hashes="$(sha256sum "$passenger_apk" "$driver_apk" "$admin_apk" | awk '{print $1}' | sort -u | wc -l)"
if [ "$unique_hashes" -ne 3 ]; then
  echo "Error: dos botones de descarga recibirían la misma APK." >&2
  exit 1
fi

echo "APK verificadas: Pasajero, Conductor y Administrador son aplicaciones independientes."
