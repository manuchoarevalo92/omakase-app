/** Mensaje legible para errores de PostgREST / Supabase (RLS, permisos, etc.). */
export function formatPostgrestError(error: {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}): string {
  const bits: string[] = [error.message];
  if (error.details) {
    bits.push(String(error.details));
  }
  if (error.hint) {
    bits.push(`Sugerencia: ${error.hint}`);
  }
  const msg = error.message.toLowerCase();
  if (
    msg.includes("pedidos_proveedores") &&
    (msg.includes("pedidos_proveedores_proveedor_check") ||
      msg.includes("proveedor_check"))
  ) {
    bits.push(
      "El CHECK de la columna proveedor en Supabase está desactualizado (faltan proveedores nuevos en la lista permitida). En Dashboard → SQL Editor ejecutá: supabase/proveedores-pescaderias-corunesas.sql (o supabase/pedidos-proveedores-extend-proveedores.sql) y volvé a cargar la página."
    );
  }
  if (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("violates row-level security") ||
    msg.includes("permission denied") ||
    error.code === "42501"
  ) {
    if (msg.includes("recetas")) {
      bits.push(
        "RLS en la tabla recetas: la app usa la anon key. En Supabase → SQL Editor, creá políticas para el rol anon que permitan SELECT, INSERT y UPDATE (el guardado usa upsert). Ver supabase/recetas-rls-anon.sql en el repo."
      );
    } else if (msg.includes("platos")) {
      bits.push(
        "RLS en platos: la app usa la anon key. Hacen falta políticas SELECT, INSERT, UPDATE y DELETE para anon (ver supabase/platos-rls-anon.sql en el repo)."
      );
    } else if (msg.includes("pedidos_proveedores")) {
      bits.push(
        "RLS en pedidos_proveedores: hacen falta políticas SELECT, INSERT y UPDATE para anon (ver supabase/pedidos-proveedores-rls-anon.sql en el repo)."
      );
    } else if (msg.includes("bebidas_asientos")) {
      if (msg.includes("historial_servicio_id")) {
        bits.push(
          "Falta la columna historial_servicio_id en bebidas_asientos. Ejecutá supabase/bebidas-asientos-historial-servicio.sql en el SQL Editor."
        );
      } else {
        bits.push(
          "RLS en bebidas_asientos: hacen falta políticas SELECT, INSERT y UPDATE para anon (ver supabase/bebidas-asientos-rls-anon.sql en el repo)."
        );
      }
    } else if (msg.includes("historial_servicios")) {
      bits.push(
        "RLS en historial_servicios: hace falta INSERT y SELECT para anon si guardás menú y ves el historial."
      );
    } else if (msg.includes("ingredientes")) {
      bits.push(
        "RLS en ingredientes: la app usa la anon key. Hacen falta políticas SELECT, INSERT, UPDATE y DELETE para anon (ver supabase/ingredientes-rls-anon.sql en el repo)."
      );
    } else if (msg.includes("compras_historial")) {
      bits.push(
        "RLS en compras_historial: hacen falta políticas SELECT, INSERT, UPDATE y DELETE para anon (ver supabase/compras-historial-rls-anon.sql en el repo)."
      );
    } else if (msg.includes("stock_items")) {
      bits.push(
        "RLS en stock_items: hacen falta políticas SELECT, INSERT, UPDATE y DELETE para anon (ver supabase/stock-items-rls-anon.sql en el repo)."
      );
    } else {
      bits.push(
        "Error de permisos / RLS en Supabase: revisá las políticas de la tabla indicada en el mensaje para el rol anon (clave pública del cliente)."
      );
    }
  }
  if (
    msg.includes("could not find") &&
    msg.includes("column") &&
    msg.includes("schema cache")
  ) {
    bits.push(
      "La tabla en Supabase no tiene esa columna (o PostgREST no la ve todavía). Revisá el SQL Editor: suele resolverse con ALTER TABLE … ADD COLUMN o refrescando el esquema en API → Settings."
    );
    if (msg.includes("recetas") && msg.includes("pax")) {
      bits.push(
        'Ejemplo: alter table public.recetas add column if not exists pax integer; (archivo supabase/recetas-pax.sql en el repo).'
      );
    }
    if (msg.includes("ingredientes") && msg.includes("rubro")) {
      bits.push(
        "Ejemplo: supabase/ingredientes-rubro.sql (columna rubro en public.ingredientes)."
      );
    }
    if (msg.includes("stock_items")) {
      bits.push(
        "Ejecutá supabase/stock-items.sql en el SQL Editor para crear la tabla stock_items."
      );
    }
    if (msg.includes("compras_historial") && (msg.includes("precio") || msg.includes("importe"))) {
      bits.push(
        "Ejecutá supabase/compras-historial-precio.sql en el SQL Editor (columnas precio_unitario e importe_total)."
      );
    } else if (msg.includes("compras_historial")) {
      bits.push(
        "Ejecutá supabase/compras-historial.sql en el SQL Editor para crear la tabla compras_historial."
      );
    }
  }
  if (
    msg.includes("stock_items") &&
    (msg.includes("stock_items_proveedor_check") || msg.includes("proveedor_check"))
  ) {
    bits.push(
      "El CHECK de la columna proveedor en stock_items no incluye ese valor. Revisá supabase/stock-items.sql y agregá el proveedor nuevo a la lista permitida."
    );
  }
  return bits.filter(Boolean).join(" ");
}
