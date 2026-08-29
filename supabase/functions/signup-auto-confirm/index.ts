import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const allowedRoles = new Set(["usuario", "chofer", "admin"]);
const bootstrapAdminEmail = "civitaxi2024@gmail.com";
function json(status: number, payload: unknown) { return new Response(JSON.stringify(payload), { status, headers: cors }); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const requestedRole = String(body.role || "usuario").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: "Correo inválido" });
    if (password.length < 8) return json(400, { error: "La contraseña debe tener al menos 8 caracteres" });
    if (!fullName) return json(400, { error: "Ingresa tu nombre completo" });
    if (!allowedRoles.has(requestedRole)) return json(400, { error: "Tipo de cuenta inválido" });
    if (requestedRole === "admin" && email !== bootstrapAdminEmail) return json(403, { error: "Ese correo no está autorizado para crear la cuenta administradora" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, role: requestedRole } });
    if (!error && data.user) {
      if (requestedRole === "admin") {
        const { error: promoteError } = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
        if (promoteError) {
          await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
          return json(500, { error: "No se pudo activar el perfil administrador" });
        }
      }
      return json(200, { ok: true, user_id: data.user.id, existing: false });
    }

    const errorText = String(error?.message || "").toLowerCase();
    const duplicate = errorText.includes("already") || errorText.includes("registered");
    if (duplicate) return json(409, { code: "account_exists", error: "Ese correo ya está registrado. Inicia sesión con la contraseña original o usa otro correo." });
    return json(400, { error: error?.message || "No se pudo crear la cuenta" });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Error interno" });
  }
});
