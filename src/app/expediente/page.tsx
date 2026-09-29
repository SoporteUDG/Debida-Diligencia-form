import ExpedienteView from "@/components/view/ExpedienteView";

// Botón del Canvas en Zoho CRM: abre /expediente?link=<enlace del expediente> en
// una pestaña aparte. A diferencia de /view no se puede embeber (frame-ancestors
// 'none' de next.config) y no pide el enlace: viene en la URL.
export default function ExpedientePage() {
  return <ExpedienteView mode="directo" />;
}
