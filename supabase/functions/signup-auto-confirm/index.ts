import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const BOOTSTRAP_ADMIN = "civitaxi2024@gmail.com";
const allowedRoles = new Set(["usuario", "chofer", "admin"]);

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers: cors });
}

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
    if (requestedRole === "admin" && email !== BOOTSTRAP_ADMIN) {
      return json(403, { error: "Este correo no está autorizado para crear la cuenta administradora" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: requestedRole },
    });

    if (!error && data.user) {
      return json(200, { ok: true, user_id: data.user.id, existing: false });
    }

    const errorText = String(error?.message || "").toLowerCase();
    const duplicate = errorText.includes("already") || errorText.includes("registered");
    if (!duplicate) return json(400, { error: error?.message || "No se pudo crear la cuenta" });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,role,email")
      .eq("email", email)
      .maybeSingle();

    if (profileError || !profile?.id) {
      return json(409, { error: "La cuenta ya existe. Inicia sesión con tu contraseña." });
    }
    if (profile.role !== requestedRole) {
      return json(409, { error: "Ese correo ya pertenece a otro tipo de cuenta CiviTaxi" });
    }

    const { error: confirmError } = await admin.auth.admin.updateUserById(profile.id, {
      email_confirm: true,
    });
    if (confirmError) return json(400, { error: confirmError.message });

    return json(200, { ok: true, user_id: profile.id, existing: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Error interno" });
  }
});
