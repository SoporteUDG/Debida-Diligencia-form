import { describe, it, expect } from "vitest";
import { esMarcadorWorkDrive, esDescargable } from "../workdriveFileId";

describe("workdriveFileId", () => {
  it("reconoce los marcadores de sincronización pendiente", () => {
    expect(esMarcadorWorkDrive("PENDING_SYNC")).toBe(true);
    expect(esMarcadorWorkDrive("LOCAL_BACKUP")).toBe(true);
    expect(esMarcadorWorkDrive(" PENDING_SYNC ")).toBe(true);
  });

  it("no confunde un id real con un marcador", () => {
    expect(esMarcadorWorkDrive("4e5gt459b4236d43448729898663d52da24bc")).toBe(false);
    expect(esMarcadorWorkDrive(null)).toBe(false);
    expect(esMarcadorWorkDrive(undefined)).toBe(false);
    expect(esMarcadorWorkDrive("")).toBe(false);
  });

  it("sólo se descarga un documento vivo con id real", () => {
    expect(esDescargable({ zohoFileId: "pn7wi284a2b5", status: "PENDING" })).toBe(true);
    expect(esDescargable({ zohoFileId: "pn7wi284a2b5", status: "APPROVED" })).toBe(true);
    // Caso real del expediente de Varela: subida a WorkDrive sin completar.
    expect(esDescargable({ zohoFileId: "PENDING_SYNC", status: "PENDING" })).toBe(false);
    expect(esDescargable({ zohoFileId: "pn7wi284a2b5", status: "DELETED" })).toBe(false);
    expect(esDescargable({ zohoFileId: null, status: "APPROVED" })).toBe(false);
  });
});
