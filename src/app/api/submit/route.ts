import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { naturalFormSchema, juridicaFormSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || (type !== "natural" && type !== "juridica")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario no especificado o inválido" },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron datos de formulario" },
        { status: 400 }
      );
    }

    // 1. Validate based on client type
    const schema = type === "natural" ? naturalFormSchema : juridicaFormSchema;
    const validation = schema.safeParse(data);

    if (!validation.success) {
      // Map Zod errors to a flat key-value object of path -> message
      const fieldErrors: Record<string, string> = {};
      
      validation.error.issues.forEach((err) => {
        const path = err.path.join(".");
        fieldErrors[path] = err.message;
      });

      console.warn(`[Submit API] Validación fallida para tipo: ${type}`, fieldErrors);
      return NextResponse.json(
        { success: false, error: "Errores de validación en los campos del formulario", errors: fieldErrors },
        { status: 400 }
      );
    }

    const validatedData = validation.data;
    console.log(`[Submit API] Validación exitosa para tipo: ${type}. Guardando en base de datos...`);

    // 2. Persist to Neon Postgres via Prisma
    let dbFormId = "";
    
    if (type === "natural") {
      const naturalData = validatedData as z.infer<typeof naturalFormSchema>;
      const clientName = `${naturalData.firstName || ""} ${naturalData.lastName || ""}`.trim() || "Cliente Natural";
      const dbForm = await prisma.form.create({
        data: {
          type: "NATURAL",
          status: "SUBMITTED",
          clientName,
          projectName: naturalData.nombreProyecto || "General UDG",
          data: naturalData as any,
          conclusionesVerificacion: naturalData.conclusionesVerificacion || null,
          submittedAt: new Date(),
          signature: {
            create: {
              signerName: naturalData.signerName,
              signatureDate: new Date(naturalData.signatureDate),
              firmaImage: naturalData.firmaImage,
            }
          },
          documents: {
            create: [
              ...(naturalData.idFile ? [{ name: "Copia ID", fileType: "pdf", url: naturalData.idFile }] : []),
              ...(naturalData.proofAddressFile ? [{ name: "Prueba de Domicilio", fileType: "pdf", url: naturalData.proofAddressFile }] : []),
              ...(naturalData.origenFondosFile ? [{ name: "Origen de Fondos", fileType: "pdf", url: naturalData.origenFondosFile }] : []),
              ...(naturalData.otrosAdjuntosFile ? [{ name: "Otros Adjuntos", fileType: "pdf", url: naturalData.otrosAdjuntosFile }] : []),
            ]
          }
        }
      });
      dbFormId = dbForm.id;
    } else {
      const juridicaData = validatedData as z.infer<typeof juridicaFormSchema>;
      const clientName = juridicaData.razonSocial || "Empresa Registrada";
      const dbForm = await prisma.form.create({
        data: {
          type: "JURIDICA",
          status: "SUBMITTED",
          clientName,
          projectName: juridicaData.nombreProyecto || "General UDG",
          data: juridicaData as any,
          conclusionesVerificacion: juridicaData.conclusionesVerificacion || null,
          submittedAt: new Date(),
          signature: {
            create: {
              signerName: juridicaData.signerName,
              signatureDate: new Date(juridicaData.signatureDate),
              firmaImage: juridicaData.firmaImage,
            }
          },
          legalRepresentative: {
            create: {
              nombre: juridicaData.rlNombre,
              fechaNacimiento: juridicaData.rlFechaNacimiento ? new Date(juridicaData.rlFechaNacimiento) : null,
              nacionalidad: juridicaData.rlNacionalidad,
              noIdentificacion: juridicaData.rlNoIdentificacion,
              profesionOcupacion: juridicaData.rlProfesionOcupacion,
              actividadEconomica: juridicaData.rlActividadEconomica || null,
              direccion: juridicaData.rlDireccion || null,
              paisResidencia: juridicaData.rlPaisResidencia || null,
              telefono: juridicaData.rlTelefono || null,
              objetoInvestigacion: juridicaData.rlObjetoInvestigacion,
            }
          },
          gjcMembers: {
            create: (juridicaData.gjcMembers || []).map((m: any) => ({
              cargo: m.cargo,
              nombre: m.nombre,
              apellidos: m.apellidos,
              nacionalidad: m.nacionalidad,
              fechaNacimiento: m.fechaNacimiento ? new Date(m.fechaNacimiento) : null,
              nroId: m.nroId,
              direccion: m.direccion,
            }))
          },
          bfMembers: {
            create: (juridicaData.bfMembers || []).map((m: any) => ({
              nombreCompleto: m.nombreCompleto,
              noIdentificacion: m.noIdentificacion,
              nacionalidad: m.nacionalidad,
              fechaAdquisicion: m.fechaAdquisicion ? new Date(m.fechaAdquisicion) : null,
              porcentajeParticipacion: m.porcentajeParticipacion,
              paisNacimiento: m.paisNacimiento,
              direccion: m.direccion,
            }))
          },
          documents: {
            create: [
              ...(juridicaData.copiaIdFile ? [{ name: "Copia ID Dignatarios", fileType: "pdf", url: juridicaData.copiaIdFile }] : []),
              ...(juridicaData.avisoOperacionesFile ? [{ name: "Aviso de Operaciones", fileType: "pdf", url: juridicaData.avisoOperacionesFile }] : []),
              ...(juridicaData.origenFondosFile ? [{ name: "Origen de Fondos", fileType: "pdf", url: juridicaData.origenFondosFile }] : []),
              ...(juridicaData.serviciosPublicosFile ? [{ name: "Factura Servicios Públicos", fileType: "pdf", url: juridicaData.serviciosPublicosFile }] : []),
              ...(juridicaData.pactoSocialFile ? [{ name: "Pacto Social", fileType: "pdf", url: juridicaData.pactoSocialFile }] : []),
              ...(juridicaData.certBancariaFile ? [{ name: "Certificación Bancaria", fileType: "pdf", url: juridicaData.certBancariaFile }] : []),
              ...(juridicaData.certRegistroFile ? [{ name: "Certificado Registro Público", fileType: "pdf", url: juridicaData.certRegistroFile }] : []),
            ]
          }
        }
      });
      dbFormId = dbForm.id;
    }

    return NextResponse.json({
      success: true,
      message: "Formulario enviado y persistido correctamente en la base de datos",
      submissionId: dbFormId,
    });

  } catch (error: any) {
    console.error("[Submit API] Error al guardar en base de datos:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor al procesar el envío" },
      { status: 500 }
    );
  }
}
