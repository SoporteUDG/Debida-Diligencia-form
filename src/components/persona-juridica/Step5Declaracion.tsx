"use client";

import { FormState } from "@/types/persona-juridica";
import { useEffect, useRef, useState } from "react";
import { Trash2, PenTool, Type, HelpCircle } from "lucide-react";

interface Step5Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  errors: Record<string, string>;
}

export default function Step5Declaracion({ formData, onInputChange, errors = {} }: Step5Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [typedFontIndex, setTypedFontIndex] = useState(0);

  const fontInlineStyles = [
    "'Great Vibes', 'Brush Script MT', cursive",
    "'Sacramento', 'Brush Script MT', cursive",
    "'Dancing Script', 'Brush Script MT', cursive",
  ];

  // Load Google Cursive Fonts dynamically for premium look
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&family=Great+Vibes&family=Sacramento&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Sync canvas width and height for drawing mode
  useEffect(() => {
    if (signatureMode === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = 180;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#002b49";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }

      // Load existing signature if it exists
      if (formData.firmaImage) {
        const img = new Image();
        img.src = formData.firmaImage;
        img.onload = () => {
          ctx?.drawImage(img, 0, 0);
        };
      }
    }
  }, [signatureMode]);

  // Asynchronously generate typed calligraphic signature image to prevent state batching conflicts
  useEffect(() => {
    if (signatureMode === "type") {
      if (!formData.signerName.trim()) {
        if (formData.firmaImage) {
          const event = {
            target: { name: "firmaImage", value: "" },
          } as any;
          onInputChange(event);
        }
        return;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 500;
      tempCanvas.height = 180;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 500, 180);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 500, 180);

        ctx.font = `italic 38px ${fontInlineStyles[typedFontIndex]}`;
        ctx.fillStyle = "#002b49";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(formData.signerName, 250, 90);

        const dataUrl = tempCanvas.toDataURL("image/png");
        if (formData.firmaImage !== dataUrl) {
          const event = {
            target: { name: "firmaImage", value: dataUrl },
          } as any;
          onInputChange(event);
        }
      }
    }
  }, [formData.signerName, signatureMode, typedFontIndex]);

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveCanvasToState();
  };

  const getEventCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    const event = {
      target: {
        name: "firmaImage",
        value: "",
      },
    } as any;
    onInputChange(event);
  };

  const saveCanvasToState = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const event = {
        target: {
          name: "firmaImage",
          value: dataUrl,
        },
      } as any;
      onInputChange(event);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* SECTION: FIRMA Y DECLARACIÓN DEL CLIENTE */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3 mb-6">
          FIRMA Y DECLARACIÓN DEL CLIENTE
        </h3>

        {/* Declaraciones Juradas */}
        <div className="bg-zinc-950/30 border border-zinc-200/80 rounded-xl p-6 text-xs text-zinc-700 space-y-4 max-h-96 overflow-y-auto leading-relaxed font-sans scrollbar-thin">
          <p className="font-semibold text-zinc-900">
            Declaro de manera voluntaria, libre de cualquier error, fuerza o dolo que todas las afirmaciones y respuestas que he manifestado en este documento son correctas, veraces, completas y autorizo a <strong className="text-[#002b49]">URBAN DEVELOPMENT GROUP</strong> a verificar toda la información detallada. Además, me obligo a informar a <strong className="text-[#002b49]">URBAN DEVELOPMENT GROUP</strong> de cualquier cambio o actualización de información que pueda afectar las afirmaciones y respuestas anotadas en este formulario:
          </p>

          <ol className="list-decimal pl-4 space-y-3 text-zinc-600">
            <li>
              Declaro y certifico que toda la información brindada en este formulario es correcta, verdadera y que las fotocopias de pasaportes, documentos de identidad personal y otros documentos requeridos en esta solicitud son verdaderos.
            </li>
            <li>
              Declara el firmante que acepta que nuestra empresa puede verificar la información proporcionada en este formulario, en cualquier momento de la relación comercial.
            </li>
            <li>
              Declara el firmante que de acuerdo con lo dispuesto en la Ley 23 del 27 de abril de 2015, en el Decreto 35 -2022 y de la Resolución No. JD-001-015 de 14 de agosto de 2015 emitida por la Intendencia de Supervisión y Regulación de los sujetos obligados no financieros, nuestra empresa solicitará actualización de esta información anualmente, mientras dure la relación comercial.
            </li>
            <li>
              Declara el firmante que no ha estado involucrado o no ha sido condenado en Panamá, ni en ningún otro país por la comisión de delitos relacionados al lavado de dinero, tráfico de drogas, terrorismo, fraude o delitos de cualquier naturaleza.
            </li>
            <li>
              Declara el firmante que los servicios o bienes solicitados a nuestra empresa solo serán utilizados para fines lícitos.
            </li>
            <li>
              Declara el firmante que reconoce que esta empresa está autorizada a suministrar cualquier información requerida por la Autoridad Competente.
            </li>
            <li>
              Declara el firmante que exonera a nuestra empresa de cualquier responsabilidad en caso de que una Autoridad competente nos requiera información relacionada con la relación comercial.
            </li>
            <li>
              Declara el firmante que se compromete a informar a nuestra empresa de cualquier cambio de la información suministrada en el formulario. <strong className="text-[#002b49]">URBAN DEVELOPMENT GROUP</strong> y sus empresas asociadas, de ahora en adelante denominadas El Grupo, manejará los datos personales proporcionados por usted a través de la página web, formularios digitales o físicos, correos electrónicos, aplicaciones móviles o cualquier medio en el cual usted proporcionen sus datos conforme a lo siguiente:
              
              <div className="mt-2.5 pl-3 border-l-2 border-zinc-200 space-y-2">
                <span className="font-semibold block text-zinc-700">a) FINALIDAD DEL TRATAMIENTO DE DATOS PERSONALES:</span>
                <p>
                  Que mis datos personales serán tratados por UDG, para las siguientes finalidades: a) Remisión de información referente a nuestros proyectos; el trámite de mi solicitud de vinculación como contraparte contractual ii) el proceso de negociación del contrato de compra, iii) la ejecución y el cumplimiento de los contratos que celebre, iv) el control y la prevención del fraude, v) relación con el banco del CLIENTE vi) Efectuar las gestiones pertinentes para el desarrollo del objeto social y actividades empresariales de EL CLIENTE, así como para el giro de sus negocios, proyectos, campañas, contacto, información, ventas, ofertas, e iniciativas de innovación, entre otras;
                </p>
                <p>
                  (b) Efectuar las gestiones pertinentes para permitir la completa ejecución de los procesos y deberes precontractuales, contractuales y post contractuales con EL CLIENTE, respecto de cualquiera de los productos, servicios u obligaciones ofrecidos por UDG, que haya o no adquirido, o respecto de cualquier relación negoció subyacente que tenga con ella, incluyendo cobros prejudiciales y judiciales;
                </p>
                <p>
                  (c) Realizar campañas, concursos, evaluaciones de calidad de servicios, encuestas de satisfacción, comunicaciones y envío de información al titular relativa a eventos, productos, servicios, ofertas, promociones, publicidad, mercadeo, alianzas, concursos, de desarrollo de servicios, comerciales y contenidos propios, de terceros y/o de sus aliados comerciales, directamente o a través de terceros;
                </p>
                <p>
                  (d) Implementar estrategias de relacionamiento con clientes, proveedores, accionistas y otros terceros con los cuales UDG tenga relaciones contractuales o legales;
                </p>
                <p>
                  (e) Invitar a eventos, ofertar nuevos productos, y la realización de todas aquellas actividades asociadas a la relación comercial o vínculo existente con UDG o aquel que llegare a tener;
                </p>
                <p>
                  (f) Acceder, consultar, comparar, evaluar y reportar toda la información que sobre EL CLIENTE que se encuentre almacenada en las bases de datos de cualquier central de riesgo crediticio, financiero, de antecedentes judiciales o de seguridad, de naturaleza estatal o privada, nacional o extranjera, o cualquier base de datos comercial o de servicios, que permita establecer de manera integral e histórica completa, el comportamiento que como deudor, usuario, cliente, garante, endosante, afiliado, beneficiario, suscriptor, contribuyente, empleado, contractor y/o como titular de servicios financieros, comerciales o de cualquier otra índole, así como listas y bases de datos nacionales e internacionales, propias y de terceros, para la prevención de actividades ilícitas como el lavado de activos y la financiación del terrorismo. Todo lo anterior se realizará en beneficio propio o de terceros aliados;
                </p>
                <p>
                  (g) Responder requerimientos judiciales o administrativos y el cumplimiento de mandatos judiciales o legales;
                </p>
                <p>
                  (i) Controlar el acceso a las instalaciones, establecer medidas de seguridad, incluyendo la videovigilancia y la grabación de circuito cerrado de televisión y medidas de bioseguridad obligatorias, para proteger la integridad y seguridad de las personas y bienes, el cumplimiento de horarios y obligaciones laborales, entre otros. Estos datos son aquellos: (i) recolectados directamente en las garitas, puntos de seguridad y de atención, (ii) tomados de los documentos que suministran las personas al personal de seguridad y (iii) obtenidos de las videograbaciones que se realizan.
                </p>
              </div>
            </li>
          </ol>

          <p className="font-semibold text-zinc-900 border-t border-zinc-200/60 pt-3 mt-3">
            Declaro de manera voluntaria, libre de cualquier error, fuerza o dolo que todas las afirmaciones y respuestas que he manifestado en este documento son correctas, veraces, completas y autorizo a La Empresa., a verificar toda la información detallada. Además, me obligo a informar a La Empresa, de cualquier cambio o actualización de información que pueda afectar las afirmaciones y respuestas anotadas en este formulario, en un término no mayor a 30 días.
          </p>
        </div>

        {/* Form Inputs for Name and Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="signerName">
              Nombre del Cliente / Representante Legal <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="signerName"
              name="signerName"
              value={formData.signerName}
              onChange={onInputChange}
              placeholder="Escribe tu nombre completo"
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.signerName
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
              required
            />
            {errors.signerName && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.signerName}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="signatureDate">
              Fecha <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="date"
              id="signatureDate"
              name="signatureDate"
              value={formData.signatureDate}
              onChange={onInputChange}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.signatureDate
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
              required
            />
            {errors.signatureDate && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.signatureDate}
              </span>
            )}
          </div>
        </div>

        {/* Signature Pad Area */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              Firma Digital del Cliente <span className="text-red-500 font-bold">*</span>
            </label>
            
            {/* Signature Mode Selector */}
            <div className="flex items-center gap-1.5 bg-[#f4f6f8] border border-zinc-200 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setSignatureMode("draw");
                  clearSignature();
                }}
                className={`inline-flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-md transition ${
                  signatureMode === "draw"
                    ? "bg-white text-[#002b49] shadow-sm"
                    : "text-zinc-500 hover:text-[#002b49]"
                }`}
              >
                <PenTool className="h-3 w-3" />
                Dibujar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignatureMode("type");
                  clearSignature();
                }}
                className={`inline-flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-md transition ${
                  signatureMode === "type"
                    ? "bg-white text-[#002b49] shadow-sm"
                    : "text-zinc-500 hover:text-[#002b49]"
                }`}
              >
                <Type className="h-3 w-3" />
                Texto Cursivo
              </button>
            </div>
          </div>

          <div className={`relative border rounded-lg bg-zinc-50 min-h-[220px] overflow-hidden flex flex-col p-4 ${
            errors.firmaImage ? "border-red-500 bg-red-50/5" : "border-zinc-300"
          }`}>
            {errors.firmaImage && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mb-2 animate-fadeIn">
                ⚠️ {errors.firmaImage}
              </span>
            )}
            {signatureMode === "draw" ? (
              <canvas
                ref={canvasRef}
                className="w-full h-[180px] bg-white border border-zinc-250 rounded-lg cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            ) : (
              <div className="w-full flex-1 flex flex-col gap-4">
                
                {/* Dedicated direct input for typing the cursive signature */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                    Escribe tu nombre para la firma caligráfica:
                  </label>
                  <input
                    type="text"
                    name="signerName"
                    value={formData.signerName}
                    onChange={onInputChange}
                    placeholder="Escribe tu nombre aquí..."
                    className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#002b49] focus:ring-1 focus:ring-[#002b49] transition text-zinc-800"
                  />
                </div>

                <div className="h-[120px] bg-white border border-zinc-200 rounded-lg flex flex-col items-center justify-center relative">
                  {formData.signerName ? (
                    <div 
                      className="text-4xl text-[#002b49] select-none text-center font-semibold px-4"
                      style={{ fontFamily: fontInlineStyles[typedFontIndex] }}
                    >
                      {formData.signerName}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400 italic">Escribe tu nombre arriba para generar tu firma cursiva</span>
                  )}
                </div>
                
                {formData.signerName && (
                  <div className="flex gap-2 justify-center">
                    {fontInlineStyles.map((font, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTypedFontIndex(idx)}
                        style={{ fontFamily: fontInlineStyles[idx] }}
                        className={`text-sm px-4 py-1.5 border rounded-md transition ${
                          typedFontIndex === idx
                            ? "bg-[#002b49] text-white border-transparent"
                            : "bg-white text-[#002b49] border-zinc-300 hover:bg-zinc-100"
                        }`}
                      >
                        Estilo {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Clear Button */}
            {formData.firmaImage && (
              <button
                type="button"
                onClick={clearSignature}
                className="absolute bottom-3 right-3 bg-white hover:bg-red-50 text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                title="Borrar firma"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Terms Acceptance Checkbox */}
        <div className="flex flex-col gap-1.5 pt-4 border-t border-zinc-100">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="termsAccepted"
              name="termsAccepted"
              checked={formData.termsAccepted}
              onChange={onInputChange}
              className="mt-1 h-4 w-4 rounded border-zinc-300 bg-[#f4f6f8] text-[#c8a788] accent-[#c8a788] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              required
            />
            <label htmlFor="termsAccepted" className="text-xs text-zinc-500 leading-normal select-none cursor-pointer">
              Doy consentimiento legal expreso, certifico que la información declarada es verídica e íntegra, y autorizo el análisis conforme a la Ley de Prevención de Capitales.
            </label>
          </div>
          {errors.termsAccepted && (
            <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
              ⚠️ {errors.termsAccepted}
            </span>
          )}
        </div>
      </div>

      {/* SECTION: SOLO PARA USO DE LA EMPRESA */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3">
          SOLO PARA USO DE LA EMPRESA
        </h3>

        <div className="space-y-6 text-[#1a1c1a]">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="conclusionesVerificacion">
              CONCLUSIONES DE LA VERIFICACIÓN
            </label>
            <textarea
              id="conclusionesVerificacion"
              name="conclusionesVerificacion"
              value={formData.conclusionesVerificacion || ""}
              onChange={onInputChange}
              rows={4}
              placeholder="Escribe aquí las observaciones o conclusiones del análisis de cumplimiento..."
              className="w-full bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#002b49] focus:ring-1 focus:ring-[#002b49] transition text-zinc-800 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 max-w-sm">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="crmid">
              crmid
            </label>
            <input
              type="text"
              id="crmid"
              name="crmid"
              value={formData.crmid || ""}
              onChange={onInputChange}
              placeholder="Código identificador de Zoho CRM"
              className="bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#002b49] focus:ring-1 focus:ring-[#002b49] transition text-zinc-800"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
