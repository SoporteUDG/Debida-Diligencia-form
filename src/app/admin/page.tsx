"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Building2, 
  User, 
  Search, 
  Download, 
  Eye, 
  Trash2, 
  FileText, 
  ShieldCheck, 
  PlusCircle, 
  ArrowLeft,
  X,
  Save,
  CheckCircle2,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  CalendarPlus,
  RefreshCw,
  Bell
} from "lucide-react";
import { generatePDF } from "@/lib/pdfGenerator";

interface Submission {
  id: string;
  type: "natural" | "juridica";
  clientName: string;
  projectName: string;
  submittedAt: string | null;
  status: string;
  data: any;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "natural" | "juridica">("all");
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [conclusiones, setConclusiones] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalTab, setModalTab] = useState<"general" | "socios" | "origen" | "expediente" | "firma">("general");

  // Link Generation States
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [clientType, setClientType] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [projectName, setProjectName] = useState("");
  const [advisorName, setAdvisorName] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Cargar envíos desde la base de datos (con fallback a localStorage)
  const fetchSubmissions = async () => {
    try {
      const res = await fetch("/api/trpc/getSubmissions");
      if (res.ok) {
        const json = await res.json();
        if (json.result?.data) {
          const dbMapped = json.result.data.map((item: any) => ({
            id: item.id,
            type: item.type.toLowerCase(),
            clientName: item.clientName,
            projectName: item.projectName,
            submittedAt: item.submittedAt,
            status: item.status,
            data: item.data,
          }));
          
          if (dbMapped.length > 0) {
            setSubmissions(dbMapped);
            return;
          }
        }
      }
    } catch (e) {
      console.error("[Admin] Error fetching database submissions:", e);
    }

    // Fallback to localStorage
    const list = localStorage.getItem("udg_submissions");
    if (list) {
      try {
        setSubmissions(JSON.parse(list));
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const saveSubmissions = (newList: Submission[]) => {
    setSubmissions(newList);
    localStorage.setItem("udg_submissions", JSON.stringify(newList));
  };

  const handleGenerateDemo = () => {
    const demo: Submission[] = [
      {
        id: "NAT-352981",
        type: "natural",
        clientName: "Juan Antonio Pérez Miranda",
        projectName: "Costa del Este Residence",
        submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        status: "Enviado",
        data: {
          nombreProyecto: "Costa del Este Residence",
          formaContacto: "Recomendado por Broker",
          firstName: "Juan Antonio",
          lastName: "Pérez Miranda",
          paisNacimiento: "Panamá",
          paisResidenciaFiscal: "Panamá",
          idTributaria: "8-752-1928",
          nationality: "Panameña",
          tipoIdentificacion: "Cédula",
          idNumber: "8-752-1928",
          fechaNacimiento: "1985-06-15",
          direccionResidencial: "Costa del Este, Ave. Boulevard, Edif. Sunset, Apto 14A",
          ciudad: "Ciudad de Panamá",
          provinciaEstado: "Panamá",
          paisResidencial: "Panamá",
          email: "juan.perez@email.com",
          telefono: "260-1234",
          celular: "6612-9876",
          profession: "Ingeniero Civil",
          employer: "Constructora del Pacífico S.A.",
          actividadLaboral: "CONSTRUCCIÓN",
          cargoDesempena: "Director de Proyectos",
          actEconPrincipal: "Salario Profesional",
          pctDedicacionPrincipal: "90",
          jurisdiccionPrincipal: "Panamá",
          ingresosMensuales: "7,500 - 10,000 USD",
          medioPago: "Transferencia ACH",
          fuenteFondosInmueble: "Ahorros Propios",
          montoServiciosAnuales: "$50,010 a $100,000",
          adquiereNombreTercero: "No",
          destinoInmueble: "Vivienda Principal",
          esPep: "No",
          idFile: "cedula_juan_perez.pdf",
          origenFondosFile: "carta_trabajo_perez.pdf",
          proofAddressFile: "recibo_electricidad_cde.pdf",
          termsAccepted: true,
          signerName: "Juan A. Pérez M.",
          signatureDate: new Date().toLocaleDateString(),
          firmaImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAABkCAYAAABgCAYAAADQC4GPAAAAAXNSR0IArs4c6QAAAXlJREFUeF7t0sENgEAQA8G7E/pPylQEC7h7C2fGssmv9QyMAtsZ2D0zGhgFAsoR0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAsrx0wIKyA7SAgLK8dMCAsoO0gICyvHTAgrIDtICAgp7G7G0wF7xAAAAAElFTkSuQmCC",
          conclusionesVerificacion: "El expediente cuenta con todos los documentos requeridos. No se identificaron factores de riesgo de lavado de dinero."
        }
      }
    ];
    saveSubmissions(demo);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de eliminar este expediente?")) {
      const filtered = submissions.filter(sub => sub.id !== id);
      saveSubmissions(filtered);
      if (selectedSub?.id === id) {
        setSelectedSub(null);
      }
    }
  };

  const handleSelect = (sub: Submission) => {
    setSelectedSub(sub);
    setConclusiones(sub.data.conclusionesVerificacion || "");
  };

  const handleSaveConclusions = async () => {
    if (!selectedSub) return;
    
    // Check if ID is database UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedSub.id);
    if (isUuid) {
      try {
        const res = await fetch("/api/trpc/updateConclusions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            formId: selectedSub.id,
            conclusiones,
          }),
        });
        if (res.ok) {
          await fetchSubmissions();
          setSelectedSub(prev => prev ? {
            ...prev,
            data: {
              ...prev.data,
              conclusionesVerificacion: conclusiones
            }
          } : null);
          setShowSuccessToast(true);
          setTimeout(() => {
            setShowSuccessToast(false);
          }, 3000);
          return;
        }
      } catch (e) {
        console.error("[Admin] Error updating database conclusions:", e);
      }
    }

    const updated = submissions.map(sub => {
      if (sub.id === selectedSub.id) {
        const updatedData = {
          ...sub.data,
          conclusionesVerificacion: conclusiones
        };
        return {
          ...sub,
          data: updatedData
        };
      }
      return sub;
    });

    saveSubmissions(updated);
    setSelectedSub({
      ...selectedSub,
      data: {
        ...selectedSub.data,
        conclusionesVerificacion: conclusiones
      }
    });

    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("[Logout Error]:", err);
    }
  };

  const handleSearchContacts = async (query: string) => {
    setSearchQuery(query);
    setSelectedContact(null);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/trpc/searchCrmContacts?input=${encodeURIComponent(JSON.stringify({ query }))}`);
      if (res.ok) {
        const json = await res.json();
        if (json.result?.data) {
          setSearchResults(json.result.data);
        }
      }
    } catch (err) {
      console.error("[Search Contacts Error]:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedContact || !projectName || !advisorName) return;
    setIsGenerating(true);
    setGeneratedLink("");
    setLinkCopied(false);
    try {
      const res = await fetch("/api/trpc/generateClientLink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          crmId: selectedContact.id,
          clientType,
          projectName,
          advisorName,
          module: selectedContact.module,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.result?.data?.clientUrl) {
          setGeneratedLink(json.result.data.clientUrl);
          await fetchSubmissions();
        } else {
          alert("Error: " + (json.error?.message || "No se pudo generar el enlace"));
        }
      } else {
        const json = await res.json();
        alert("Error: " + (json.error?.message || "No se pudo generar el enlace"));
      }
    } catch (err) {
      console.error("[Generate Link Error]:", err);
      alert("Error al conectar con el servidor para generar el enlace");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExtendLink = async (tokenUuid: string) => {
    if (isReactivating) return;
    setIsReactivating(true);
    try {
      const res = await fetch("/api/trpc/reactivateClientToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tokenUuid,
          extendDays: 30,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.result?.data?.success) {
          alert("Vigencia del enlace extendida por 30 días adicionales con éxito.");
          await fetchSubmissions();
          // Update selectedSub to reflect the new expiration date
          if (selectedSub) {
            setSelectedSub((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                data: {
                  ...prev.data,
                  tokenExpiresAt: json.result.data.newExpiresAt,
                  tokenUsed: false,
                },
              };
            });
          }
        } else {
          alert("Error: " + (json.error?.message || "No se pudo extender la vigencia"));
        }
      } else {
        alert("Error al conectar con el servidor.");
      }
    } catch (err) {
      console.error("[Extend Link Error]:", err);
      alert("Ocurrió un error al extender la vigencia del enlace.");
    } finally {
      setIsReactivating(false);
    }
  };

  const handleRegenerateLink = async (tokenUuid: string) => {
    if (isRegenerating) return;
    if (!confirm("¿Estás seguro de regenerar este enlace? Esto invalidará el token actual permanentemente y creará uno nuevo.")) return;
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/trpc/regenerateClientLink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tokenUuid,
          expiresInDays: 30,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.result?.data?.success) {
          alert("Enlace regenerado con éxito. El enlace antiguo ha sido invalidado.");
          await fetchSubmissions();
          // Update selectedSub with the new token
          if (selectedSub) {
            setSelectedSub((prev) => {
              if (!prev) return null;
              const newSignedToken = json.result.data.signedToken;
              const newExpiresAt = new Date();
              newExpiresAt.setDate(newExpiresAt.getDate() + 30);
              return {
                ...prev,
                data: {
                  ...prev.data,
                  token: newSignedToken,
                  tokenExpiresAt: newExpiresAt.toISOString(),
                  tokenUsed: false,
                },
              };
            });
          }
        } else {
          alert("Error: " + (json.error?.message || "No se pudo regenerar el enlace"));
        }
      } else {
        alert("Error al conectar con el servidor.");
      }
    } catch (err) {
      console.error("[Regenerate Link Error]:", err);
      alert("Ocurrió un error al regenerar el enlace.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSendReminder = async (tokenUuid: string) => {
    if (isSendingReminder) return;
    setIsSendingReminder(true);
    try {
      const res = await fetch("/api/trpc/sendClientReminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tokenUuid,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.result?.data?.success) {
          alert("Recordatorio enviado con éxito al cliente a través de Zoho CRM.");
        } else {
          alert("Error: " + (json.error?.message || "No se pudo enviar el recordatorio"));
        }
      } else {
        alert("Error al conectar con el servidor.");
      }
    } catch (err) {
      console.error("[Send Reminder Error]:", err);
      alert("Ocurrió un error al enviar el recordatorio.");
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleDownloadPDF = (sub: Submission, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const dateStr = sub.submittedAt 
      ? new Date(sub.submittedAt).toLocaleDateString()
      : new Date().toLocaleDateString();
    generatePDF(sub.type, sub.data, sub.id, dateStr);
  };

  // Filtrado y Búsqueda
  const filteredList = submissions.filter(sub => {
    const matchesSearch = sub.clientName.toLowerCase().includes(search.toLowerCase()) || 
                          sub.projectName.toLowerCase().includes(search.toLowerCase()) ||
                          sub.id.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" ? true : sub.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#001b2e] text-zinc-100 flex flex-col font-sans selection:bg-[#c8a788]/30">
      
      {/* Navbar Premium */}
      <header className="border-b border-zinc-800 bg-[#002b49] px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-zinc-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-serif font-semibold text-white tracking-wider uppercase">
              Oficina de Cumplimiento UDG
            </h1>
            <p className="text-[10px] text-zinc-400 font-sans uppercase tracking-[0.15em]">
              Panel de Control e Inspección de Expedientes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedContact(null);
              setSearchQuery("");
              setSearchResults([]);
              setProjectName("");
              setAdvisorName("");
              setGeneratedLink("");
              setShowLinkModal(true);
            }}
            className="bg-[#c8a788] hover:bg-yellow-650 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#c8a788]/10 active:scale-95"
          >
            <Link2 className="w-4 h-4 text-zinc-950" />
            Generar Enlace
          </button>

          <button
            onClick={handleGenerateDemo}
            className="border border-dashed border-[#c8a788]/60 hover:bg-[#c8a788]/10 text-[#c8a788] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Cargar Datos Demo
          </button>
          
          <button
            onClick={handleLogout}
            className="bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/55 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* Lado Izquierdo: Lista de Expedientes */}
        <section className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-serif font-light text-white tracking-wide">
                Expedientes Recibidos
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Revisa la documentación, formula conclusiones y descarga reportes PDF firmados de forma segura.
              </p>
            </div>
            <div className="text-xs text-[#c8a788] font-bold bg-[#c8a788]/10 px-3 py-1.5 rounded-lg border border-[#c8a788]/20">
              Total: {filteredList.length} expediente(s)
            </div>
          </div>

          {/* Filtros y Buscador */}
          <div className="bg-[#002b49]/60 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
            {/* Buscador */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, proyecto o ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#001b2e] border border-zinc-700/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-[#c8a788] transition"
              />
            </div>

            {/* Tabs de Filtro */}
            <div className="flex bg-[#001b2e] border border-zinc-700/60 rounded-xl p-1 w-full md:w-auto">
              <button
                onClick={() => setFilterType("all")}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-medium tracking-wide transition cursor-pointer ${
                  filterType === "all" 
                    ? "bg-[#c8a788] text-zinc-950 font-semibold shadow-md" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType("natural")}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-medium tracking-wide transition cursor-pointer ${
                  filterType === "natural" 
                    ? "bg-[#c8a788] text-zinc-950 font-semibold shadow-md" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Naturales
              </button>
              <button
                onClick={() => setFilterType("juridica")}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-medium tracking-wide transition cursor-pointer ${
                  filterType === "juridica" 
                    ? "bg-[#c8a788] text-zinc-950 font-semibold shadow-md" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Jurídicos
              </button>
            </div>
          </div>

          {/* Listado de Expedientes */}
          {filteredList.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-800/40 flex items-center justify-center mx-auto text-zinc-500">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-zinc-300">No hay expedientes</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-normal">
                  No se encontraron registros que coincidan con la búsqueda o aún no se han enviado expedientes. Puedes cargar datos de demostración en el botón superior.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#002b49]/30 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px] bg-zinc-900/20">
                      <th className="py-4 px-6 font-semibold">ID</th>
                      <th className="py-4 px-6 font-semibold">Cliente / Razón Social</th>
                      <th className="py-4 px-6 font-semibold">Proyecto</th>
                      <th className="py-4 px-6 font-semibold">Tipo</th>
                      <th className="py-4 px-6 font-semibold">Estado</th>
                      <th className="py-4 px-6 font-semibold">Fecha Envío</th>
                      <th className="py-4 px-6 font-semibold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredList.map(sub => {
                      const isSelected = selectedSub?.id === sub.id;
                      return (
                        <tr
                          key={sub.id}
                          onClick={() => handleSelect(sub)}
                          className={`hover:bg-[#c8a788]/5 transition cursor-pointer ${
                            isSelected ? "bg-[#c8a788]/10" : ""
                          }`}
                        >
                          <td className="py-4 px-6 font-mono font-bold text-zinc-200">
                            {sub.id}
                          </td>
                          <td className="py-4 px-6 font-medium text-white">
                            {sub.clientName}
                          </td>
                          <td className="py-4 px-6 text-zinc-300">
                            {sub.projectName}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              sub.type === "natural" 
                                ? "bg-blue-900/30 text-blue-300 border border-blue-800/40" 
                                : "bg-purple-900/30 text-purple-300 border border-purple-800/40"
                            }`}>
                              {sub.type === "natural" ? (
                                <User className="w-3 h-3" />
                              ) : (
                                <Building2 className="w-3 h-3" />
                              )}
                              {sub.type === "natural" ? "Persona" : "Empresa"}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              sub.status === "DRAFT" || sub.status === "Pendiente"
                                ? "bg-yellow-950/40 text-yellow-300 border border-yellow-800/30"
                                : sub.status === "APPROVED" || sub.status === "Aprobado"
                                  ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900/30"
                                  : "bg-blue-950/40 text-blue-300 border border-blue-900/30"
                            }`}>
                              {sub.status === "DRAFT" || sub.status === "Pendiente" ? "Pendiente" : "Enviado"}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-zinc-400">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : "Pendiente (No enviado)"}
                          </td>
                          <td className="py-4 px-6 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  handleSelect(sub);
                                  setShowDetailModal(true);
                                }}
                                title="Ver Detalles"
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-[#c8a788] hover:text-zinc-950 text-zinc-400 transition active:scale-90"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDownloadPDF(sub, e)}
                                title="Descargar Expediente PDF"
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-[#c8a788] hover:text-zinc-950 text-zinc-400 transition active:scale-90"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(sub.id, e)}
                                title="Eliminar"
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-600 hover:text-white text-zinc-400 transition active:scale-90"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Lado Derecho: Inspector / Visualizador de Detalles */}
        <aside className="w-full lg:w-[450px] bg-[#00223a] border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col max-h-[calc(100vh-80px)] overflow-y-auto">
          {selectedSub ? (
            <div className="flex-1 flex flex-col p-6 space-y-6">
              
              {/* Header Detalle */}
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                <div>
                  <span className="text-[10px] text-[#c8a788] font-bold uppercase tracking-wider">
                    Expediente {selectedSub.type === "natural" ? "Persona Natural" : "Persona Jurídica"}
                  </span>
                  <h3 className="text-lg font-serif font-semibold text-white tracking-wide mt-1">
                    {selectedSub.clientName}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">ID: {selectedSub.id}</p>
                  <button
                    onClick={() => {
                      setModalTab("general");
                      setShowDetailModal(true);
                    }}
                    className="mt-2.5 bg-[#c8a788] hover:bg-yellow-600 text-zinc-950 px-3 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspeccionar Completo
                  </button>
                </div>
                <button
                  onClick={() => setSelectedSub(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Contenido Ficha Técnica */}
              <div className="flex-1 space-y-5 overflow-y-auto pr-1 text-xs">
                
                {/* Datos del Proyecto */}
                <div className="bg-[#001b2e]/60 p-4 rounded-xl border border-zinc-800 space-y-2">
                  <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider">
                    Asociación Inmobiliaria
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-zinc-400">
                    <div>
                      <span className="block text-[10px] text-zinc-500 font-semibold">Proyecto:</span>
                      <span className="text-white font-medium">{selectedSub.projectName}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500 font-semibold">
                        {selectedSub.data.isDraftRecord ? "Asesor Asignado:" : "Método Contacto:"}
                      </span>
                      <span className="text-white font-medium text-ellipsis overflow-hidden block">
                        {selectedSub.data.isDraftRecord 
                          ? (selectedSub.data.asesorAsignado || "No asignado") 
                          : (selectedSub.data.formaContacto || "-")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enlace de Cliente si es Borrador */}
                {selectedSub.data.isDraftRecord && selectedSub.data.token && (() => {
                  const isExpired = selectedSub.data.tokenExpiresAt
                    ? new Date(selectedSub.data.tokenExpiresAt).getTime() < Date.now()
                    : false;
                  const isInvalid = isExpired || selectedSub.data.tokenUsed;

                  return (
                    <div className="bg-yellow-950/20 border border-yellow-800/40 p-4 rounded-xl space-y-3">
                      <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5 text-yellow-500" />
                        Enlace de Acceso
                      </span>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Copia y envía este enlace para que el cliente complete el formulario:
                      </p>
                      
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={
                            typeof window !== "undefined"
                              ? `${window.location.origin}/persona-${selectedSub.type}?token=${selectedSub.data.token}`
                              : `/persona-${selectedSub.type}?token=${selectedSub.data.token}`
                          }
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-300 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const url = typeof window !== "undefined"
                              ? `${window.location.origin}/persona-${selectedSub.type}?token=${selectedSub.data.token}`
                              : `/persona-${selectedSub.type}?token=${selectedSub.data.token}`;
                            navigator.clipboard.writeText(url);
                            alert("Enlace copiado al portapapeles");
                          }}
                          className="bg-[#c8a788] hover:bg-yellow-600 text-zinc-950 px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                          title="Copiar Enlace"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Status and Expiration Info */}
                      <div className="space-y-1.5 border-t border-zinc-800/60 pt-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-500 font-semibold uppercase">Estado Enlace:</span>
                          {isInvalid ? (
                            <span className="bg-red-950/50 border border-red-800/40 text-red-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Expirado / Revocado
                            </span>
                          ) : (
                            <span className="bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Activo
                            </span>
                          )}
                        </div>

                        {selectedSub.data.tokenExpiresAt && (
                          <div className="text-[10px] text-zinc-450 flex justify-between">
                            <span className="text-zinc-500 font-semibold uppercase">Vence el:</span>
                            <span className="font-mono text-zinc-300">
                              {new Date(selectedSub.data.tokenExpiresAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            const parts = selectedSub.data.token.split(".");
                            if (parts.length > 0) {
                              handleExtendLink(parts[0]);
                            }
                          }}
                          disabled={isReactivating}
                          className="flex-1 bg-zinc-800 hover:bg-[#c8a788] hover:text-zinc-950 disabled:opacity-50 text-zinc-300 px-2 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Extender Vigencia por 30 días"
                        >
                          {isReactivating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CalendarPlus className="w-3.5 h-3.5" />
                          )}
                          Extender
                        </button>

                        <button
                          onClick={() => {
                            const parts = selectedSub.data.token.split(".");
                            if (parts.length > 0) {
                              handleRegenerateLink(parts[0]);
                            }
                          }}
                          disabled={isRegenerating}
                          className="flex-1 bg-zinc-800 hover:bg-yellow-600 hover:text-zinc-950 disabled:opacity-50 text-zinc-300 px-2 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Invalidar enlace actual y generar uno nuevo"
                        >
                          {isRegenerating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Regenerar
                        </button>

                        <button
                          onClick={() => {
                            const parts = selectedSub.data.token.split(".");
                            if (parts.length > 0) {
                              handleSendReminder(parts[0]);
                            }
                          }}
                          disabled={isSendingReminder}
                          className="flex-1 bg-[#c8a788]/20 border border-[#c8a788]/30 hover:bg-[#c8a788] hover:text-zinc-950 disabled:opacity-50 text-[#c8a788] px-2 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Enviar recordatorio a Zoho CRM"
                        >
                          {isSendingReminder ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Bell className="w-3.5 h-3.5" />
                          )}
                          Recordatorio
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Perfil del Solicitante */}
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider border-b border-zinc-800 pb-1">
                    Datos del Solicitante
                  </h4>
                  {selectedSub.type === "natural" ? (
                    <div className="space-y-2 text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Identificación:</span>
                        <span>{selectedSub.data.tipoIdentificacion || "Cédula"}: {selectedSub.data.idNumber || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Nacionalidad:</span>
                        <span>{selectedSub.data.nationality || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Estatus Migratorio:</span>
                        <span>{selectedSub.data.estatusMigratorio || "Nacional"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Fecha Nacimiento:</span>
                        <span>{selectedSub.data.fechaNacimiento || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Correo Electrónico:</span>
                        <span>{selectedSub.data.email || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Profesión:</span>
                        <span>{selectedSub.data.profession || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Empleador:</span>
                        <span>{selectedSub.data.employer || "-"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">R.U.C. / Registro:</span>
                        <span>{selectedSub.data.ruc || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Fecha Constitución:</span>
                        <span>{selectedSub.data.fechaConstitucion || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Representante Legal:</span>
                        <span>{selectedSub.data.rlNombreCompleto || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">ID Representante:</span>
                        <span>{selectedSub.data.rlNroId || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Correo Electrónico:</span>
                        <span>{selectedSub.data.email || "-"}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Perfil Financiero */}
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider border-b border-zinc-800 pb-1">
                    Origen de Fondos y PEP
                  </h4>
                  <div className="space-y-2 text-zinc-300">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Ingresos Mensuales:</span>
                      <span>{selectedSub.data.ingresosMensuales || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Medio de Pago:</span>
                      <span>{selectedSub.data.medioPago || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Fuente Fondos:</span>
                      <span>{selectedSub.data.fuenteFondosInmueble || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Persona PEP:</span>
                      <span className={`font-bold ${selectedSub.data.esPep === "Sí" ? "text-yellow-500" : "text-emerald-500"}`}>
                        {selectedSub.data.esPep || "No"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista de Socios y Directores para Jurídico */}
                {selectedSub.type === "juridica" && (
                  <>
                    {/* Junta Directiva */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider border-b border-zinc-800 pb-1">
                        Miembros de Gobierno (GJC)
                      </h4>
                      <div className="space-y-2">
                        {selectedSub.data.gjcMembers?.map((m: any, idx: number) => (
                          <div key={idx} className="bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-800 text-[11px]">
                            <p className="font-bold text-zinc-200">{m.nombre} {m.apellidos}</p>
                            <div className="grid grid-cols-2 text-zinc-400 mt-1 text-[10px]">
                              <span>Cargo: {m.cargo}</span>
                              <span>Nacionalidad: {m.nacionalidad}</span>
                              <span>Doc: {m.nroId}</span>
                              <span>F. Nac: {m.fechaNacimiento}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Beneficiarios Finales */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider border-b border-zinc-800 pb-1">
                        Beneficiarios Finales (BF)
                      </h4>
                      <div className="space-y-2">
                        {selectedSub.data.bfMembers?.map((b: any, idx: number) => (
                          <div key={idx} className="bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-800 text-[11px]">
                            <p className="font-bold text-zinc-200">{b.nombreCompleto}</p>
                            <div className="grid grid-cols-2 text-zinc-400 mt-1 text-[10px]">
                              <span>Participación: {b.porcentajeParticipacion}%</span>
                              <span>Doc: {b.noIdentificacion}</span>
                              <span>Nac: {b.nacionalidad}</span>
                              <span>País Nac: {b.paisNacimiento}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Adjuntos Registrados */}
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-300 text-[10px] uppercase tracking-wider border-b border-zinc-800 pb-1">
                    Archivos Digitalizados
                  </h4>
                  <div className="space-y-1">
                    {selectedSub.type === "natural" ? (
                      <>
                        <div className="flex items-center justify-between text-zinc-400 bg-zinc-900/20 p-2 rounded-lg">
                          <span>Identificación</span>
                          <span className="text-[#c8a788] text-[10px]">{selectedSub.data.idFile || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400 bg-zinc-900/20 p-2 rounded-lg">
                          <span>Origen Fondos</span>
                          <span className="text-[#c8a788] text-[10px]">{selectedSub.data.origenFondosFile || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400 bg-zinc-900/20 p-2 rounded-lg">
                          <span>Comprobante Domicilio</span>
                          <span className="text-[#c8a788] text-[10px]">{selectedSub.data.proofAddressFile || "-"}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-zinc-400 bg-zinc-900/20 p-2 rounded-lg">
                          <span>Pacto Social</span>
                          <span className="text-[#c8a788] text-[10px]">{selectedSub.data.pactoSocialFile || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400 bg-zinc-900/20 p-2 rounded-lg">
                          <span>Aviso de Operaciones</span>
                          <span className="text-[#c8a788] text-[10px]">{selectedSub.data.avisoOperacionesFile || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400 bg-zinc-900/20 p-2 rounded-lg">
                          <span>Servicios Públicos</span>
                          <span className="text-[#c8a788] text-[10px]">{selectedSub.data.serviciosPublicosFile || "-"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* Panel de Evaluación / Conclusiones del Oficial */}
              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                  Evaluación y Conclusión de Debida Diligencia
                </label>
                <textarea
                  rows={4}
                  placeholder="Escribe aquí las notas del análisis de riesgo, listas de control (World-Check, OFAC) y dictamen final..."
                  value={conclusiones}
                  onChange={e => setConclusiones(e.target.value)}
                  className="w-full bg-[#001b2e] border border-zinc-700/60 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-[#c8a788] transition"
                />
                
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveConclusions}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Notas
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(selectedSub)}
                    className="bg-[#c8a788] hover:bg-yellow-600 text-zinc-950 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-4">
              <ShieldCheck className="w-12 h-12 text-zinc-650" />
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium text-zinc-400">Inspector de Cumplimiento</h4>
                <p className="text-xs text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
                  Selecciona un expediente de la tabla para auditar los detalles estructurados, revisar los documentos adjuntos y emitir tu resolución de riesgo.
                </p>
              </div>
            </div>
          )}
        </aside>

      </main>

      {/* Notificación de Guardado */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-500/30 animate-scaleIn">
          <CheckCircle2 className="w-5 h-5" />
          <div className="text-xs">
            <p className="font-bold">¡Notas actualizadas con éxito!</p>
            <p className="text-[10px] text-emerald-100">Las conclusiones han sido grabadas en el expediente.</p>
          </div>
        </div>
      )}

      {/* Modal Detallado de Inspección de Expediente Completo */}
      {showDetailModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#00223a] border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Header del Modal */}
            <div className="bg-[#002b49] px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedSub.type === "natural" 
                      ? "bg-blue-900/30 text-blue-300 border border-blue-800/40" 
                      : "bg-purple-900/30 text-purple-300 border border-purple-800/40"
                  }`}>
                    {selectedSub.type === "natural" ? "Persona Natural" : "Persona Jurídica"}
                  </span>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
                    ID: {selectedSub.id}
                  </span>
                </div>
                <h2 className="text-xl font-serif font-semibold text-white mt-1.5">
                  Expediente de {selectedSub.clientName}
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Proyecto: <span className="text-white font-medium">{selectedSub.projectName}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownloadPDF(selectedSub)}
                  className="bg-[#c8a788] hover:bg-yellow-600 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Banner de Sólo Lectura */}
            <div className="bg-amber-950/20 border-b border-amber-900/30 px-6 py-2.5 flex items-center justify-between text-[11px] text-amber-300 font-semibold tracking-wide">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span>EXPEDIENTE EN MODO SOLO LECTURA — LOS DATOS DEL CLIENTE NO PUEDEN SER ALTERADOS</span>
              </div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-[0.1em] font-mono">
                UDG COMPLIANCE PROTOCOL
              </span>
            </div>

            {/* Tabs de Navegación Interna */}
            <div className="bg-[#002b49]/40 border-b border-zinc-800/80 px-6 py-2 flex gap-1 overflow-x-auto">
              <button
                onClick={() => setModalTab("general")}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  modalTab === "general" ? "bg-[#c8a788]/20 text-[#c8a788] font-bold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Datos Generales
              </button>
              {selectedSub.type === "juridica" && (
                <button
                  onClick={() => setModalTab("socios")}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    modalTab === "socios" ? "bg-[#c8a788]/20 text-[#c8a788] font-bold" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Socios y Gobierno GJC/BF
                </button>
              )}
              <button
                onClick={() => setModalTab("origen")}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  modalTab === "origen" ? "bg-[#c8a788]/20 text-[#c8a788] font-bold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Origen de Fondos y PEP
              </button>
              <button
                onClick={() => setModalTab("expediente")}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  modalTab === "expediente" ? "bg-[#c8a788]/20 text-[#c8a788] font-bold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Documentos e Integraciones
              </button>
              <button
                onClick={() => setModalTab("firma")}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  modalTab === "firma" ? "bg-[#c8a788]/20 text-[#c8a788] font-bold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Firma Digital
              </button>
            </div>

            {/* Contenido Dinámico de la Tab */}
            <div className="flex-1 overflow-y-auto p-6 text-xs text-zinc-300 space-y-6">
              
              {modalTab === "general" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedSub.type === "natural" ? (
                    <>
                      {/* Datos Personales */}
                      <div className="space-y-4 bg-[#001b2e]/40 p-5 rounded-2xl border border-zinc-800">
                        <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                          Identidad del Solicitante
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Nombres</p>
                            <p className="text-white font-medium text-sm mt-0.5">{selectedSub.data.firstName || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Apellidos</p>
                            <p className="text-white font-medium text-sm mt-0.5">{selectedSub.data.lastName || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">País de Nacimiento</p>
                            <p className="text-white mt-0.5">{selectedSub.data.paisNacimiento || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Nacionalidad</p>
                            <p className="text-white mt-0.5">{selectedSub.data.nationality || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Tipo de ID</p>
                            <p className="text-white mt-0.5">{selectedSub.data.tipoIdentificacion || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">N° de Identificación</p>
                            <p className="text-white font-mono mt-0.5">{selectedSub.data.idNumber || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Fecha de Nacimiento</p>
                            <p className="text-white mt-0.5">{selectedSub.data.fechaNacimiento || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Estatus Migratorio</p>
                            <p className="text-white mt-0.5">{selectedSub.data.estatusMigratorio || "Nacional"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Contacto y Trabajo */}
                      <div className="space-y-4 bg-[#001b2e]/40 p-5 rounded-2xl border border-zinc-800">
                        <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                          Contacto y Actividad Laboral
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Dirección Residencial</p>
                            <p className="text-white mt-0.5">{selectedSub.data.direccionResidencial || "-"}, {selectedSub.data.ciudad || ""}, {selectedSub.data.paisResidencial || ""}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Correo Electrónico</p>
                            <p className="text-white font-mono mt-0.5">{selectedSub.data.email || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Celular / Teléfono</p>
                            <p className="text-white mt-0.5">{selectedSub.data.celularCodigo || ""}{selectedSub.data.celular || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Profesión</p>
                            <p className="text-white mt-0.5">{selectedSub.data.profession === "Otros" ? selectedSub.data.profesionOtros : selectedSub.data.profession || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Empresa Empleadora</p>
                            <p className="text-white mt-0.5">{selectedSub.data.employer || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Cargo</p>
                            <p className="text-white mt-0.5">{selectedSub.data.cargoDesempena || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Actividad Principal</p>
                            <p className="text-white mt-0.5">{selectedSub.data.actEconPrincipal || "-"}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Datos de la Sociedad */}
                      <div className="space-y-4 bg-[#001b2e]/40 p-5 rounded-2xl border border-zinc-800">
                        <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                          Información de la Sociedad
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Razón Social</p>
                            <p className="text-white font-medium text-sm mt-0.5">{selectedSub.data.razonSocial || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">R.U.C. / Documento</p>
                            <p className="text-white font-mono mt-0.5">{selectedSub.data.numeroDocumento || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Tipo de Sociedad</p>
                            <p className="text-white mt-0.5">{selectedSub.data.tipoSociedad || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Fecha Constitución</p>
                            <p className="text-white mt-0.5">{selectedSub.data.fechaConstitucion || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">País de Inscripción</p>
                            <p className="text-white mt-0.5">{selectedSub.data.paisInscripcion || "-"}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Dirección de Empresa</p>
                            <p className="text-white mt-0.5">{selectedSub.data.empresaDireccion || "-"}, {selectedSub.data.empresaCiudad || ""}, {selectedSub.data.empresaPais || ""}</p>
                          </div>
                        </div>
                      </div>

                      {/* Representación Legal y Contacto */}
                      <div className="space-y-4 bg-[#001b2e]/40 p-5 rounded-2xl border border-zinc-800">
                        <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                          Representación y Enlace
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Representante Legal</p>
                            <p className="text-white font-medium mt-0.5">{selectedSub.data.rlNombre || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">ID Representante</p>
                            <p className="text-white font-mono mt-0.5">{selectedSub.data.rlNoIdentificacion || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Nacionalidad Rep.</p>
                            <p className="text-white mt-0.5">{selectedSub.data.rlNacionalidad || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Persona de Contacto</p>
                            <p className="text-white mt-0.5">{selectedSub.data.contactoNombre} {selectedSub.data.contactoApellido}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase">Email de Contacto</p>
                            <p className="text-white font-mono mt-0.5">{selectedSub.data.contactoEmail || "-"}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {modalTab === "socios" && selectedSub.type === "juridica" && (
                <div className="space-y-6">
                  {/* Miembros Gobierno */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                      Junta Directiva y Estructura Organizativa (GJC)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedSub.data.gjcMembers?.map((m: any, idx: number) => (
                        <div key={idx} className="bg-[#001b2e]/40 p-4 rounded-xl border border-zinc-800/80">
                          <p className="font-bold text-white text-sm">{m.nombre} {m.apellidos}</p>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 mt-2">
                            <div>
                              <span className="text-[9px] text-zinc-500 block uppercase">Cargo</span>
                              <span className="text-zinc-200">{m.cargo}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-500 block uppercase">Documento</span>
                              <span className="text-zinc-200">{m.nroId}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-500 block uppercase">Nacionalidad</span>
                              <span className="text-zinc-200">{m.nacionalidad}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-500 block uppercase">F. Nacimiento</span>
                              <span className="text-zinc-200">{m.fechaNacimiento}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-[9px] text-zinc-500 block uppercase">Dirección</span>
                              <span className="text-zinc-200">{m.direccion}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Beneficiarios Finales */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                      Beneficiarios Finales (BF)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedSub.data.bfMembers?.map((b: any, idx: number) => (
                        <div key={idx} className="bg-[#001b2e]/40 p-4 rounded-xl border border-zinc-800/80">
                          <div className="flex justify-between items-start">
                            <p className="font-bold text-white text-sm">{b.nombreCompleto}</p>
                            <span className="text-[#c8a788] font-mono font-bold text-xs bg-[#c8a788]/10 px-2 py-0.5 rounded border border-[#c8a788]/20">
                              {b.porcentajeParticipacion}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 mt-2">
                            <div>
                              <span className="text-[9px] text-zinc-500 block uppercase">Identificación</span>
                              <span className="text-zinc-200">{b.noIdentificacion}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-500 block uppercase">Nacionalidad</span>
                              <span className="text-zinc-200">{b.nacionalidad}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-500 block uppercase">País de Nacimiento</span>
                              <span className="text-zinc-200">{b.paisNacimiento}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-[9px] text-zinc-500 block uppercase">Dirección</span>
                              <span className="text-zinc-200">{b.direccion}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "origen" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Origen de Fondos */}
                  <div className="space-y-4 bg-[#001b2e]/40 p-5 rounded-2xl border border-zinc-800">
                    <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                      Perfil Financiero y Fondos
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">Ingresos Mensuales</p>
                        <p className="text-white font-medium mt-0.5">{selectedSub.data.ingresosMensuales || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">Medio de Pago</p>
                        <p className="text-white font-medium mt-0.5">{selectedSub.data.medioPago || "-"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">Fuente de Fondos del Inmueble</p>
                        <p className="text-white mt-0.5">{selectedSub.data.fuenteFondosInmueble || "-"}</p>
                      </div>
                      {selectedSub.type === "natural" ? (
                        <div>
                          <p className="text-[10px] text-zinc-500 font-semibold uppercase">Monto de Servicios Anuales</p>
                          <p className="text-white mt-0.5">{selectedSub.data.montoServiciosAnuales || "-"}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] text-zinc-500 font-semibold uppercase">Volumen de Actividad Comercial</p>
                          <p className="text-white mt-0.5">{selectedSub.data.porcentajeActividad || "-"}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">Uso/Destino del Inmueble</p>
                        <p className="text-white mt-0.5">{selectedSub.data.destinoInmueble || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* PEP Questionnaire */}
                  <div className="space-y-4 bg-[#001b2e]/40 p-5 rounded-2xl border border-zinc-800">
                    <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                      Declaración PEP (Personas Expuestas Políticamente)
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">¿Es Persona Expuesta Políticamente?</p>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-1 ${
                          selectedSub.data.esPep === "Sí"
                            ? "bg-yellow-900/30 text-yellow-300 border border-yellow-800/40"
                            : "bg-emerald-900/30 text-emerald-300 border border-emerald-800/40"
                        }`}>
                          {selectedSub.data.esPep || "No"}
                        </span>
                      </div>
                      
                      {selectedSub.data.esPep === "Sí" && (
                        <div className="grid grid-cols-2 gap-3 text-zinc-300 mt-2 bg-zinc-950/20 p-3 rounded-lg border border-zinc-850">
                          <div>
                            <span className="text-[9px] text-zinc-500 block uppercase">Nombre Completo</span>
                            <span>{selectedSub.data.pepNombre || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-500 block uppercase">Cargo Público</span>
                            <span>{selectedSub.data.pepCargo || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-500 block uppercase">Institución</span>
                            <span>{selectedSub.data.pepInstitucion || "-"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-500 block uppercase">Relación / Parentesco</span>
                            <span>{selectedSub.data.pepRelacion || "Titular"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "expediente" && (
                <div className="space-y-6">
                  {/* Adjuntos y Enlaces */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                      Expediente Digitalizado (Enlaces Zoho WorkDrive)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedSub.data.documents && selectedSub.data.documents.length > 0 ? (
                        selectedSub.data.documents.map((doc: any) => (
                          <a
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#001b2e]/40 p-4 rounded-xl border border-zinc-800 hover:border-[#c8a788]/60 transition flex items-center justify-between text-zinc-300 cursor-pointer"
                          >
                            <div>
                              <p className="font-bold text-white text-[11px]">{doc.fileType || "Adjunto"}</p>
                              <p className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate max-w-[250px]">{doc.name}</p>
                            </div>
                            <span className="text-[10px] text-[#c8a788] font-bold underline flex items-center gap-1">
                              Descargar
                              <Download className="w-3.5 h-3.5" />
                            </span>
                          </a>
                        ))
                      ) : (
                        // Fallback a archivos demo
                        <>
                          <div className="bg-[#001b2e]/40 p-4 rounded-xl border border-zinc-800/80 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-white text-[11px]">Identificación (Cédula/Pasaporte)</p>
                              <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{selectedSub.data.idFile || "no_subido.pdf"}</p>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Archivo Demo</span>
                          </div>
                          <div className="bg-[#001b2e]/40 p-4 rounded-xl border border-zinc-800/80 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-white text-[11px]">Origen de Fondos</p>
                              <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{selectedSub.data.origenFondosFile || "no_subido.pdf"}</p>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Archivo Demo</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Estado de Integración de Sistemas */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                      Estado de Sincronización e Integración de Sistemas
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Zoho CRM */}
                      <div className="bg-zinc-950/20 p-4 rounded-xl border border-zinc-850 space-y-2">
                        <span className="text-[9px] text-zinc-500 font-bold block uppercase">Zoho CRM Sync</span>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            selectedSub.data.crmSync?.status === "SUCCESS" ? "bg-emerald-500" :
                            selectedSub.data.crmSync?.status === "FAILED" ? "bg-red-500" : "bg-yellow-500 animate-pulse"
                          }`} />
                          <span className="text-xs font-bold text-white">
                            {selectedSub.data.crmSync?.status || "SUCCESS (Demo)"}
                          </span>
                        </div>
                        {selectedSub.data.crmSync?.crmId && (
                          <p className="text-[9px] text-zinc-500 font-mono">ID CRM: {selectedSub.data.crmSync.crmId}</p>
                        )}
                        {selectedSub.data.crmSync?.errorMessage && (
                          <p className="text-[9px] text-red-400 font-mono truncate">{selectedSub.data.crmSync.errorMessage}</p>
                        )}
                      </div>

                      {/* Zoho WorkDrive */}
                      <div className="bg-zinc-950/20 p-4 rounded-xl border border-zinc-850 space-y-2">
                        <span className="text-[9px] text-zinc-500 font-bold block uppercase">Zoho WorkDrive Sync</span>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            selectedSub.data.workDriveSync?.status === "SUCCESS" ? "bg-emerald-500" :
                            selectedSub.data.workDriveSync?.status === "FAILED" ? "bg-red-500" : "bg-yellow-500 animate-pulse"
                          }`} />
                          <span className="text-xs font-bold text-white">
                            {selectedSub.data.workDriveSync?.status || "SUCCESS (Demo)"}
                          </span>
                        </div>
                        {selectedSub.data.workDriveSync?.folderId && (
                          <p className="text-[9px] text-zinc-500 font-mono">ID Carpeta: {selectedSub.data.workDriveSync.folderId}</p>
                        )}
                      </div>

                      {/* SAP ERP */}
                      <div className="bg-zinc-950/20 p-4 rounded-xl border border-zinc-850 space-y-2">
                        <span className="text-[9px] text-zinc-500 font-bold block uppercase">SAP ERP Integration</span>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            selectedSub.data.sapSync?.status === "SUCCESS" ? "bg-emerald-500" :
                            selectedSub.data.sapSync?.status === "FAILED" ? "bg-red-500" : "bg-yellow-500"
                          }`} />
                          <span className="text-xs font-bold text-white">
                            {selectedSub.data.sapSync?.status || "PENDING"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "firma" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Firma Image */}
                  <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center min-h-[220px]">
                    {selectedSub.data.firmaImage || selectedSub.data.signature?.firmaImage ? (
                      <img
                        src={selectedSub.data.signature?.firmaImage || selectedSub.data.firmaImage}
                        alt="Firma Digital"
                        className="max-h-[140px] object-contain invert brightness-200"
                      />
                    ) : (
                      <span className="text-zinc-500 font-medium">Sin Firma Registrada</span>
                    )}
                  </div>

                  {/* Certificado y Metadatos */}
                  <div className="space-y-4 bg-[#001b2e]/40 p-5 rounded-2xl border border-zinc-800">
                    <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider border-b border-zinc-850 pb-2">
                      Firma y Aceptación Legal
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">Firmado por</p>
                        <p className="text-white font-medium text-sm">{selectedSub.data.signature?.signerName || selectedSub.data.signerName || selectedSub.clientName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">Fecha Aceptación</p>
                        <p className="text-white">{selectedSub.data.signature?.signatureDate ? new Date(selectedSub.data.signature.signatureDate).toLocaleDateString() : selectedSub.data.signatureDate || (selectedSub.submittedAt ? new Date(selectedSub.submittedAt).toLocaleDateString() : "Pendiente")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase">Aceptación Términos y Condiciones</p>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/30 text-emerald-300 border border-emerald-900/30 uppercase tracking-wider">
                          Aceptado
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Notas del Oficial de Cumplimiento */}
            <div className="bg-[#002b49] px-6 py-5 border-t border-zinc-800 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider">
                  Evaluación y Notas Internas de la Oficina de Cumplimiento UDG
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Las conclusiones de la debida diligencia se archivarán en el expediente histórico del cliente y se actualizarán en el CRM.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                <textarea
                  rows={2}
                  placeholder="Escribe aquí el dictamen de cumplimiento, listas de verificación (World-Check, OFAC) y justificación de riesgo..."
                  value={conclusiones}
                  onChange={e => setConclusiones(e.target.value)}
                  className="flex-1 bg-[#001b2e] border border-zinc-700/60 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-[#c8a788] transition resize-none"
                />
                
                <div className="flex sm:flex-col gap-2 justify-center">
                  <button
                    onClick={handleSaveConclusions}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Notas
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 text-center"
                  >
                    Cerrar Inspector
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Generar Enlace de Cliente */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-[#001b2e]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="bg-[#002b49] border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-xs flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-serif font-semibold text-white tracking-wider uppercase">
                  Generar Enlace de Cliente
                </h3>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">
                  Iniciar expediente precargado desde Zoho CRM
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-850 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Buscador Zoho CRM */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 block">
                  1. Buscar Contacto o Lead en Zoho CRM
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Escribe el nombre o correo (mín. 2 letras)..."
                    value={searchQuery}
                    onChange={(e) => handleSearchContacts(e.target.value)}
                    className="w-full bg-[#001b2e] border border-zinc-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-[#c8a788] transition"
                  />
                </div>

                {/* Resultados de búsqueda */}
                {isSearching && (
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-450" />
                    <span>Buscando en Zoho CRM...</span>
                  </div>
                )}
                
                {!isSearching && searchResults.length > 0 && (
                  <div className="bg-[#001b2e] border border-zinc-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-zinc-850">
                    {searchResults.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setClientType(contact.type);
                          setProjectName(contact.projectInterest || "");
                          setSearchResults([]);
                        }}
                        className={`p-3 hover:bg-[#c8a788]/10 cursor-pointer flex items-center justify-between transition ${
                          selectedContact?.id === contact.id ? "bg-[#c8a788]/20" : ""
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-white">{contact.name}</p>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{contact.email || "Sin correo"}</p>
                        </div>
                        <span className="text-[9px] bg-zinc-950 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-zinc-400">
                          {contact.module}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contacto Seleccionado Badge */}
              {selectedContact && (
                <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest block">
                    Contacto Seleccionado
                  </span>
                  <p className="text-white font-medium text-sm">{selectedContact.name}</p>
                  <p className="text-[10px] text-zinc-400 font-mono">CRM ID: {selectedContact.id}</p>
                </div>
              )}

              {/* Formulario de Configuración de Enlace */}
              {selectedContact && (
                <div className="space-y-4 pt-3 border-t border-zinc-850">
                  <p className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 block">
                    2. Parámetros de Asociación
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Tipo de Cliente */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase block">
                        Tipo de Cliente
                      </label>
                      <select
                        value={clientType}
                        onChange={(e) => setClientType(e.target.value as any)}
                        className="w-full bg-[#001b2e] border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[#c8a788] transition"
                      >
                        <option value="NATURAL">Persona Natural</option>
                        <option value="JURIDICA">Persona Jurídica</option>
                      </select>
                    </div>

                    {/* Proyecto */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase block">
                        Proyecto de Interés
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Costa del Este"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full bg-[#001b2e] border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[#c8a788] transition"
                      />
                    </div>

                    {/* Asesor */}
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase block">
                        Asesor Asignado
                      </label>
                      <input
                        type="text"
                        placeholder="Ingresa tu nombre de asesor..."
                        value={advisorName}
                        onChange={(e) => setAdvisorName(e.target.value)}
                        className="w-full bg-[#001b2e] border border-zinc-700/80 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-[#c8a788] transition"
                      />
                    </div>
                  </div>

                  {/* Botón Generar */}
                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating || !projectName || !advisorName}
                    className="w-full bg-[#c8a788] hover:bg-yellow-600 text-zinc-950 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                        Generando Enlace...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 text-zinc-950" />
                        Generar Enlace Seguro
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Resultado del Enlace Generado */}
              {generatedLink && (
                <div className="bg-yellow-950/20 border border-yellow-800/40 p-5 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-yellow-500" />
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">
                      ¡Enlace Generado Correctamente!
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal">
                    El enlace ha sido guardado e integrado en Zoho CRM. Copia esta URL y envíasela al cliente para que inicie su declaración:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-[10px] font-mono text-zinc-300 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="bg-[#c8a788] hover:bg-yellow-600 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-4.5 h-4.5 text-zinc-950" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4.5 h-4.5 text-zinc-950" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowLinkModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-[#001b2e] py-6 text-center text-xs text-zinc-500">
        <p className="font-serif text-[11px] font-medium tracking-[0.1em] text-zinc-400">
          URBAN DEVELOPMENT GROUP (UDG)
        </p>
      </footer>

    </div>
  );
}
