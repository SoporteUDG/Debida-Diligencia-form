"use client";

import { FormState } from "@/types/persona-juridica";
import { useEffect, useRef, useState } from "react";
import { Trash2, PenTool, Type, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface Step5Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  errors: Record<string, string>;
}

export default function Step5Declaracion({ formData, onInputChange, errors = {} }: Step5Props) {
  const t = useTranslations("JuridicaForm.DeclarationStep.Titles");
  const p = useTranslations("JuridicaForm.DeclarationStep.Placeholders");
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
        ctx.strokeStyle = "#052B48";
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
        ctx.fillStyle = "#052B48";
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
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6">
          {t("SectionTitle")}
        </h3>

        {/* Declaraciones Juradas */}
        <div className="bg-zinc-950/30 border border-zinc-200/80 rounded-xl p-6 text-xs text-zinc-700 space-y-4 max-h-96 overflow-y-auto leading-relaxed font-sans scrollbar-thin">
          <p className="font-semibold text-zinc-900">
            {t.rich("DeclarationIntro", { strong: (chunks) => <strong className="text-[#052B48]">{chunks}</strong> })}
          </p>

          <ol className="list-decimal pl-4 space-y-3 text-zinc-600">
            <li>
              {t("Declaration1")}
            </li>
            <li>
              {t("Declaration2")}
            </li>
            <li>
              {t("Declaration3")}
            </li>
            <li>
              {t("Declaration4")}
            </li>
            <li>
              {t("Declaration5")}
            </li>
            <li>
              {t("Declaration6")}
            </li>
            <li>
              {t("Declaration7")}
            </li>
            <li>
              {t.rich("Declaration8", { strong: (chunks) => <strong className="text-[#052B48]">{chunks}</strong> })}
              
              <div className="mt-2.5 pl-3 border-l-2 border-zinc-200 space-y-2">
                <span className="font-semibold block text-zinc-700">{t("DataPurposeTitle")}</span>
                <p>
                  {t("DataPurposeA")}
                </p>
                <p>
                  {t("DataPurposeB")}
                </p>
                <p>
                  {t("DataPurposeC")}
                </p>
                <p>
                  {t("DataPurposeD")}
                </p>
                <p>
                  {t("DataPurposeE")}
                </p>
                <p>
                  {t("DataPurposeF")}
                </p>
                <p>
                  {t("DataPurposeG")}
                </p>
                <p>
                  {t("DataPurposeI")}
                </p>
              </div>
            </li>
          </ol>

          <p className="font-semibold text-zinc-900 border-t border-zinc-200/60 pt-3 mt-3">
            {t("DeclarationClosing")}
          </p>
        </div>

        {/* Form Inputs for Name and Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="signerName">
              {t("SignerNameLabel")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="signerName"
              name="signerName"
              value={formData.signerName}
              onChange={onInputChange}
              placeholder={p("SignerName")}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.signerName
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
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
              {t("SignatureDateLabel")} <span className="text-red-500 font-bold">*</span>
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
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
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
        <div className="flex flex-col gap-3 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                {t("DigitalSignatureLabel")} <span className="text-red-500 font-bold">*</span>
              </label>
            </div>
            
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
                    ? "bg-white text-[#052B48] shadow-sm"
                    : "text-zinc-500 hover:text-[#052B48]"
                }`}
              >
                <PenTool className="h-3 w-3" />
                {t("DrawModeButton")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignatureMode("type");
                  clearSignature();
                }}
                className={`inline-flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-md transition ${
                  signatureMode === "type"
                    ? "bg-white text-[#052B48] shadow-sm"
                    : "text-zinc-500 hover:text-[#052B48]"
                }`}
              >
                <Type className="h-3 w-3" />
                {t("TypeModeButton")}
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
                    {t("TypedSignatureLabel")}
                  </label>
                  <input
                    type="text"
                    name="signerName"
                    value={formData.signerName}
                    onChange={onInputChange}
                    placeholder={p("TypedSignerName")}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800"
                  />
                </div>

                <div className="h-[120px] bg-white border border-zinc-200 rounded-lg flex flex-col items-center justify-center relative">
                  {formData.signerName ? (
                    <div 
                      className="text-4xl text-[#052B48] select-none text-center font-semibold px-4"
                      style={{ fontFamily: fontInlineStyles[typedFontIndex] }}
                    >
                      {formData.signerName}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400 italic">{t("TypedSignatureEmptyHint")}</span>
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
                            ? "bg-[#052B48] text-white border-transparent"
                            : "bg-white text-[#052B48] border-zinc-300 hover:bg-zinc-100"
                        }`}
                      >
                        {t("FontStyleButton", { number: idx + 1 })}
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
                title={t("ClearSignatureTitle")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("ClearSignatureButton")}
              </button>
            )}
          </div>
        </div>

        {/* Final Checklist Area */}
        <div className="space-y-3 pt-4 border-t border-zinc-200">
          {/* Checkbox 1: Legal Consent */}
          <div className="flex flex-col gap-1.5">
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
              <label htmlFor="termsAccepted" className="text-xs text-zinc-600 leading-normal select-none cursor-pointer">
                {t("TermsAcceptedLabel")} <span className="text-red-500 font-bold">*</span>
              </label>
            </div>
            {errors.termsAccepted && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 ml-7 animate-fadeIn">
                ⚠️ {errors.termsAccepted}
              </span>
            )}
          </div>

          {/* Checkbox 2: Confirmation & Digital/Physical Signature Commitment */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="signatureConfirmed"
                name="signatureConfirmed"
                checked={formData.signatureConfirmed}
                onChange={onInputChange}
                className="mt-1 h-4 w-4 rounded border-zinc-300 bg-[#f4f6f8] text-[#c8a788] accent-[#c8a788] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                required
              />
              <label htmlFor="signatureConfirmed" className="text-xs text-zinc-600 leading-normal select-none cursor-pointer">
                {t("SignatureConfirmedLabel")} <span className="text-red-500 font-bold">*</span>
              </label>
            </div>
            {errors.signatureConfirmed && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 ml-7 animate-fadeIn">
                ⚠️ {errors.signatureConfirmed}
              </span>
            )}
          </div>
        </div>

      </div>



    </div>
  );
}
