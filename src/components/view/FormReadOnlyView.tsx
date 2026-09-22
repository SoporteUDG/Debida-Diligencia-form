"use client";

import { FileText, CheckCircle2, XCircle, Users, Landmark } from "lucide-react";

export interface ViewDocument {
  id: string;
  name: string;
  fileType: string;
  documentType?: string | null;
  personType?: string | null;
  personId?: string | null;
  status: string;
  createdAt: string;
}

export interface ViewSignature {
  signerName: string;
  signatureDate: string;
  firmaImage: string;
}

// Raw FormState payload (natural or jurídica) as stored in the DB JSON column.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ViewData = Record<string, any>;

interface Props {
  type: "natural" | "juridica";
  data: ViewData;
  documents: ViewDocument[];
  signature: ViewSignature | null;
}

type Field = { label: string; value: unknown };

// ---------- small presentational helpers ----------

const show = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  const s = String(v).trim();
  return s ? s : "—";
};

const formatDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("es-PA", { year: "numeric", month: "long", day: "numeric" });
};

const phone = (code?: string, num?: string) => (num ? `${code || ""} ${num}`.trim() : "—");

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      <div className="px-6 md:px-8 py-4 border-b border-zinc-200 bg-[#f4f6f8] flex items-center gap-2">
        {icon && <span className="text-[#c8a788]">{icon}</span>}
        <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#052B48]">{title}</h3>
      </div>
      <div className="p-6 md:p-8">{children}</div>
    </section>
  );
}

function FieldGrid({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col gap-1 min-w-0">
          <dt className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">{f.label}</dt>
          <dd className="text-sm text-zinc-900 break-words">{show(f.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function YesNo({ value }: { value: unknown }) {
  const yes = String(value || "").toLowerCase().startsWith("s") || value === true;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${yes ? "text-emerald-700" : "text-zinc-600"}`}>
      {yes ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {show(value)}
    </span>
  );
}

function PersonTable({
  rows,
  columns,
  empty,
}: {
  rows: ViewData[];
  columns: { key: string; label: string; render?: (row: ViewData) => React.ReactNode }[];
  empty: string;
}) {
  const visible = (rows || []).filter((r) => Object.values(r).some((v) => typeof v === "string" && v.trim() && v !== r.id));
  if (visible.length === 0) return <p className="text-sm text-zinc-500 italic">{empty}</p>;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
            {columns.map((c) => (
              <th key={String(c.key)} className="px-2 py-2 font-bold whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr key={row.id || i} className="border-b border-zinc-100 last:border-0 align-top">
              {columns.map((c) => (
                <td key={String(c.key)} className="px-2 py-2.5 text-zinc-800">
                  {c.render ? c.render(row) : show(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentList({ documents, data, type }: { documents: ViewDocument[]; data: ViewData; type: "natural" | "juridica" }) {
  const personName = (d: ViewDocument) => {
    if (d.personType === "RL") return data.rlNombre || "Representante Legal";
    if (d.personType === "GJC") {
      const m = (data.gjcMembers || []).find((x: ViewData) => x.id === d.personId);
      return m ? `${m.nombre} ${m.apellidos}`.trim() : "Dignatario";
    }
    if (d.personType === "BF") {
      const m = (data.bfMembers || []).find((x: ViewData) => x.id === d.personId);
      return m?.nombreCompleto || "Beneficiario Final";
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {documents.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">No se registraron documentos adjuntos.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
          {documents.map((d) => {
            const who = personName(d);
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                <FileText className="w-5 h-5 text-[#c8a788] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-900 truncate">{d.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {who ? `${who} · ` : ""}
                    {d.fileType?.toUpperCase()} · {formatDate(d.createdAt)}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">{d.status}</span>
              </li>
            );
          })}
        </ul>
      )}

      {type === "natural" && (
        <FieldGrid
          fields={[
            { label: "¿Aporta estado de cuenta?", value: data.hasEstadoCuenta },
            { label: "¿Aporta certificación bancaria?", value: data.hasCertificacionBancaria },
          ]}
        />
      )}
    </div>
  );
}

// ---------- type-specific sections ----------

function NaturalSections({ data }: { data: ViewData }) {
  return (
    <>
      <Section title="1. Proyecto y Contacto Inicial">
        <FieldGrid
          fields={[
            { label: "Nombre del Proyecto", value: data.nombreProyecto },
            { label: "Medio de Contacto", value: data.formaContacto },
            { label: "Detalle del Contacto", value: data.formaContactoDetalle },
            { label: "Referido Por", value: data.referidoPor },
          ]}
        />
      </Section>

      <Section title="2. Identificación del Cliente">
        <FieldGrid
          fields={[
            { label: "Nombre", value: data.firstName },
            { label: "Apellidos", value: data.lastName },
            { label: "Fecha de Nacimiento", value: formatDate(data.fechaNacimiento) },
            { label: "Estado Civil", value: data.estadoCivil },
            { label: "Nacionalidad", value: data.nationality },
            { label: "Otra Nacionalidad", value: data.otraNacionalidad },
            { label: "País de Nacimiento", value: data.paisNacimiento },
            { label: "Estatus Migratorio", value: data.estatusMigratorio },
            { label: "Tipo de Identificación", value: data.tipoIdentificacion },
            { label: "N° de Identificación", value: data.idNumber },
            { label: "Vencimiento de ID", value: formatDate(data.fechaVencimientoId) },
            { label: "País de Residencia Fiscal", value: data.paisResidenciaFiscal },
            { label: "NIF / ID Tributaria", value: data.idTributaria },
          ]}
        />
      </Section>

      <Section title="3. Ubicación y Contacto">
        <FieldGrid
          fields={[
            { label: "Dirección Residencial", value: data.direccionResidencial },
            { label: "Ciudad", value: data.ciudad },
            { label: "Provincia / Estado", value: data.provinciaEstado },
            { label: "País de Residencia", value: data.paisResidencial },
            { label: "Correo Electrónico", value: data.email },
            { label: "Teléfono", value: phone(data.telefonoCodigo, data.telefono) },
            { label: "Celular", value: phone(data.celularCodigo, data.celular) },
          ]}
        />
      </Section>

      <Section title="4. Datos Laborales y Actividad Económica">
        <FieldGrid
          fields={[
            { label: "Profesión u Oficio", value: data.profession === "Otros" ? data.profesionOtros : data.profession },
            { label: "País de Actividad Laboral", value: data.paisActividadLaboral },
            { label: "Empresa donde Labora", value: data.employer },
            { label: "Actividad Laboral", value: data.actividadLaboral === "Otros" ? data.actividadLaboralOtros : data.actividadLaboral },
            { label: "Cargo que Desempeña", value: data.cargoDesempena },
            { label: "Dirección Laboral", value: data.direccionLaboral },
            { label: "¿Es propietario de la entidad?", value: data.esPropietario },
            { label: "¿Usa fondos de la entidad?", value: data.usaFondos },
            { label: "Actividad Económica Principal", value: data.actEconPrincipal === "Otro" ? data.otroActEcon : data.actEconPrincipal },
            { label: "% Dedicación Principal", value: data.pctDedicacionPrincipal },
            { label: "Jurisdicción Principal", value: data.jurisdiccionPrincipal },
            { label: "Actividad Económica Secundaria", value: data.actEconSecundaria },
            { label: "% Dedicación Secundaria", value: data.pctDedicacionSecundaria },
            { label: "Jurisdicción Secundaria", value: data.jurisdiccionSecundaria },
          ]}
        />
      </Section>

      <Section title="5. Perfil Financiero">
        <FieldGrid
          fields={[
            { label: "Ingresos Mensuales Promedio", value: data.ingresosMensuales },
            { label: "Medio de Pago", value: data.medioPago },
            { label: "Fuente de Fondos del Inmueble", value: data.fuenteFondosInmueble },
            { label: "Otra Fuente (detalle)", value: data.ifOtroNombre },
            { label: "Monto Servicios Anuales", value: data.montoServiciosAnuales },
            { label: "Cantidad de Unidades", value: data.cantidadServiciosAnuales },
            { label: "Propósito / Destino del Inmueble", value: data.destinoInmueble },
            { label: "¿Adquiere a nombre de tercero?", value: data.adquiereNombreTercero },
            { label: "Nombre del Tercero", value: data.nombreTercero },
          ]}
        />
        {(data.ifTerceroNombre || data.ifTerceroNacionalidad) && (
          <div className="mt-6 pt-6 border-t border-zinc-100">
            <p className="text-[10px] font-bold tracking-wider uppercase text-[#c8a788] mb-4">Tercero Aportante de Fondos</p>
            <FieldGrid
              fields={[
                { label: "Nombre", value: data.ifTerceroNombre },
                { label: "Nacionalidad", value: data.ifTerceroNacionalidad },
                { label: "Fuente de Ingresos", value: data.ifTerceroFuenteDeIngresos },
                { label: "Relación con el Cliente", value: data.ifTerceroRelacion },
              ]}
            />
          </div>
        )}
        <PepBlock data={data} />
      </Section>
    </>
  );
}

function JuridicaSections({ data }: { data: ViewData }) {
  return (
    <>
      <Section title="1. Proyecto y Contacto Inicial">
        <FieldGrid
          fields={[
            { label: "Nombre del Proyecto", value: data.nombreProyecto },
            { label: "Medio de Contacto", value: data.formaContacto },
            { label: "Detalle del Contacto", value: data.formaContactoDetalle },
            { label: "Referido Por", value: data.referidoPor },
          ]}
        />
      </Section>

      <Section title="2. Identificación de la Empresa" icon={<Landmark className="w-4 h-4" />}>
        <FieldGrid
          fields={[
            { label: "Razón Social", value: data.razonSocial },
            { label: "Tipo de Sociedad", value: data.tipoSociedad },
            { label: "Estado de la Sociedad", value: data.estadoSociedad },
            { label: "Tipo de Cliente", value: data.tipoCliente },
            { label: "Tipo de Documento", value: data.tipoDocumentoIdentidad },
            { label: "R.U.C. / N° de Documento", value: data.numeroDocumento },
            { label: "Vencimiento del Documento", value: formatDate(data.fechaVencimientoId) },
            { label: "NIF / ID Tributaria", value: data.numeroIdTributaria },
            { label: "País de Tributación", value: data.paisTributacion },
            { label: "Fecha de Constitución", value: formatDate(data.fechaConstitucion) },
            { label: "País de Inscripción", value: data.paisInscripcion },
            { label: "País donde Opera", value: data.paisOpera },
            { label: "Actividad Principal", value: data.actividadPrincipal },
            { label: "% de la Actividad", value: data.porcentajeActividad },
          ]}
        />
        <div className="mt-6 pt-6 border-t border-zinc-100">
          <p className="text-[10px] font-bold tracking-wider uppercase text-[#c8a788] mb-4">Datos Generales de la Empresa</p>
          <FieldGrid
            fields={[
              { label: "Dirección", value: data.empresaDireccion },
              { label: "Ciudad", value: data.empresaCiudad },
              { label: "Provincia", value: data.empresaProvincia },
              { label: "País", value: data.empresaPais },
              { label: "Teléfono", value: phone(data.empresaTelefonoCodigo, data.empresaTelefono) },
              { label: "Celular", value: phone(data.empresaCelularCodigo, data.empresaCelular) },
              { label: "Correo Empresa", value: data.empresaEmail },
            ]}
          />
        </div>
        <div className="mt-6 pt-6 border-t border-zinc-100">
          <p className="text-[10px] font-bold tracking-wider uppercase text-[#c8a788] mb-4">Persona de Contacto</p>
          <FieldGrid
            fields={[
              { label: "Nombre", value: data.contactoNombre },
              { label: "Apellido", value: data.contactoApellido },
              { label: "Identificación", value: data.contactoId },
              { label: "Cargo", value: data.contactoCargo },
              { label: "Teléfono", value: data.contactoTelefono },
              { label: "Correo", value: data.contactoEmail },
              { label: "Relación con la empresa", value: data.ifContacto },
            ]}
          />
        </div>
      </Section>

      <Section title="3. Representante Legal" icon={<Users className="w-4 h-4" />}>
        <FieldGrid
          fields={[
            { label: "Nombre Completo", value: data.rlNombre },
            { label: "Fecha de Nacimiento", value: formatDate(data.rlFechaNacimiento) },
            { label: "Nacionalidad", value: data.rlNacionalidad },
            { label: "Estado Civil", value: data.rlEstadoCivil },
            { label: "N° de Identificación", value: data.rlNoIdentificacion },
            { label: "Profesión / Ocupación", value: data.rlProfesionOcupacion },
            { label: "Actividad Económica", value: data.rlActividadEconomica },
            { label: "Teléfono", value: data.rlTelefono },
            { label: "País de Residencia", value: data.rlPaisResidencia },
            { label: "Dirección", value: data.rlDireccion },
          ]}
        />
        <div className="mt-5">
          <dt className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-1">¿Objeto de investigación (AML)?</dt>
          <YesNo value={data.rlObjetoInvestigacion} />
        </div>
      </Section>

      <Section title="4. Gobierno y Junta Directiva">
        <PersonTable
          rows={data.gjcMembers || []}
          empty="No se registraron dignatarios."
          columns={[
            { key: "cargo", label: "Cargo" },
            { key: "nombre", label: "Nombre", render: (r) => `${r.nombre || ""} ${r.apellidos || ""}`.trim() || "—" },
            { key: "nacionalidad", label: "Nacionalidad" },
            { key: "fechaNacimiento", label: "F. Nacimiento", render: (r) => formatDate(r.fechaNacimiento) },
            { key: "nroId", label: "Identificación" },
            { key: "direccion", label: "Dirección" },
          ]}
        />
      </Section>

      <Section title="5. Beneficiarios Finales">
        <PersonTable
          rows={data.bfMembers || []}
          empty="No se registraron beneficiarios finales."
          columns={[
            { key: "nombreCompleto", label: "Nombre Completo" },
            { key: "noIdentificacion", label: "Identificación" },
            { key: "nacionalidad", label: "Nacionalidad" },
            { key: "paisNacimiento", label: "País Nacimiento" },
            { key: "porcentajeParticipacion", label: "% Participación" },
            { key: "fechaAdquisicion", label: "F. Adquisición", render: (r) => formatDate(r.fechaAdquisicion) },
            { key: "direccion", label: "Dirección" },
          ]}
        />
      </Section>

      <Section title="6. Perfil Financiero">
        <FieldGrid
          fields={[
            { label: "Ingresos Mensuales", value: data.ingresosMensuales },
            { label: "Medio de Pago", value: data.medioPago },
            { label: "Fuente de Fondos del Inmueble", value: data.fuenteFondosInmueble },
            { label: "¿Adquiere más de una unidad?", value: data.adquiereMasUnidades },
            { label: "Cantidad de Unidades", value: data.cantidadUnidadesInmobiliarias },
            { label: "Monto Servicios Anuales", value: data.montoServiciosAnuales },
            { label: "Actividad Comercial", value: data.actividadComercial },
            { label: "Origen de Fondos", value: data.origenFondos },
            { label: "Destino de Fondos", value: data.destinoFondos },
            { label: "Volumen de Ventas", value: data.volumenVentas },
            { label: "Banco de Referencia", value: data.bancoReferencia },
          ]}
        />
        {(data.terceroNombre || data.terceroNacionalidad) && (
          <div className="mt-6 pt-6 border-t border-zinc-100">
            <p className="text-[10px] font-bold tracking-wider uppercase text-[#c8a788] mb-4">Tercero Aportante de Fondos</p>
            <FieldGrid
              fields={[
                { label: "Nombre", value: data.terceroNombre },
                { label: "Nacionalidad", value: data.terceroNacionalidad },
                { label: "Vínculo", value: data.terceroVinculo },
                { label: "Fuente de Fondos", value: data.terceroFuenteFondos },
              ]}
            />
          </div>
        )}
        <PepBlock data={data} />
      </Section>
    </>
  );
}

function PepBlock({ data }: { data: ViewData }) {
  const isPep = String(data.esPep || "").toLowerCase().startsWith("s");
  return (
    <div className="mt-6 pt-6 border-t border-zinc-100">
      <dt className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-1">¿Persona Expuesta Políticamente (PEP)?</dt>
      <YesNo value={data.esPep} />
      {isPep && (
        <div className="mt-4">
          <FieldGrid
            fields={[
              { label: "Nombre PEP", value: data.pepNombre },
              { label: "Cargo", value: data.pepCargo },
              { label: "Institución", value: data.pepInstitucion },
              { label: "Relación", value: data.pepRelacion },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ---------- main export ----------

export default function FormReadOnlyView({ type, data, documents, signature }: Props) {
  const sig = signature || (data.firmaImage ? { signerName: data.signerName, signatureDate: data.signatureDate, firmaImage: data.firmaImage } : null);
  const docSectionNumber = type === "natural" ? 6 : 7;

  return (
    <div className="space-y-6 text-zinc-900">
      {type === "natural" ? <NaturalSections data={data} /> : <JuridicaSections data={data} />}

      <Section title={`${docSectionNumber}. Documentos Adjuntos`} icon={<FileText className="w-4 h-4" />}>
        <DocumentList documents={documents} data={data} type={type} />
      </Section>

      <Section title={`${docSectionNumber + 1}. Declaración y Firma`}>
        <FieldGrid
          fields={[
            { label: "Términos aceptados", value: data.termsAccepted },
            { label: "Firma confirmada", value: data.signatureConfirmed },
            { label: "Firmante", value: sig?.signerName || data.signerName },
            { label: "Fecha de Firma", value: formatDate(sig?.signatureDate || data.signatureDate) },
          ]}
        />
        {sig?.firmaImage && sig.firmaImage !== "NO_SIGNATURE" && (
          <div className="mt-6 pt-6 border-t border-zinc-100">
            <p className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-3">Firma Digital</p>
            <div className="inline-block bg-[#f4f6f8] border border-zinc-200 rounded-xl p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sig.firmaImage} alt="Firma" className="max-h-32 max-w-full object-contain" />
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
