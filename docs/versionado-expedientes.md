# Versionado de Expedientes

> Cambios de esquema introducidos en la migración `20260922120000_add_form_versioning`.

## 1. Problema que resuelve

Antes de este cambio, cada envío del formulario creaba un `Form` nuevo. Un
cliente que reenviaba su expediente generaba un duplicado, sin relación con el
anterior y sin constancia de quién autorizó la modificación ni de qué cambió.

Ahora un expediente es **uno solo** y acumula versiones. `Form.data` siempre
refleja la versión vigente; `FormVersion` conserva el histórico completo.

## 2. Reglas

1. Un expediente enviado (`status = SUBMITTED`) queda **bloqueado**. Reenviarlo
   no produce ningún efecto.
2. Para modificarlo hay que pulsar **"Reactivar Enlace"** en Zoho CRM. Esa acción
   crea una `FormEditAuthorization` que registra **quién** autoriza el cambio.
3. Una autorización habilita **exactamente una** modificación. Al sellarse la
   versión nueva queda marcada como consumida (`consumedAt`).
4. Cada envío sella una `FormVersion` inmutable con el `FormState` íntegro.
5. La versión 1 es el envío original del cliente y **no tiene responsable**:
   nadie tuvo que autorizarla.

## 3. Modelos nuevos

### `FormVersion`

Una fila por versión. Snapshot completo, nunca se modifica ni se borra.

| Campo | Tipo | Notas |
|---|---|---|
| `formId` | `String` | FK a `Form`, `onDelete: Cascade` |
| `version` | `Int` | 1, 2, 3… Único junto a `formId` |
| `data` | `Json` | **Snapshot íntegro del `FormState`** en esta versión |
| `status` | `FormStatus` | Estado del expediente al sellar |
| `clientName`, `projectName` | `String` | Copia, para listar sin abrir el JSON |
| `authorizationId` | `String?` | FK a la autorización que permitió el cambio |
| `authorizedBy` | `String?` | **Responsable del cambio** (usuario de Zoho). `NULL` en la v1 |
| `reason` | `String?` | Motivo declarado de la modificación |
| `changedFields` | `String[]` | Campos de primer nivel que cambiaron respecto de la versión anterior |
| `submittedAt` | `DateTime` | Momento del envío que originó la versión |

`changedFields` es **apoyo para auditoría**, no dato autoritativo: para
reconstruir cualquier versión se lee `data`, que es autosuficiente.

Índices: `@@unique([formId, version])`, `@@index([formId])`, `@@index([authorizedBy])`.

### `FormEditAuthorization`

El permiso que nace al reactivar el enlace. Deja constancia incluso de las
reactivaciones que **nunca derivaron** en un cambio (`consumedAt IS NULL`).

| Campo | Tipo | Notas |
|---|---|---|
| `formId` | `String?` | Expediente afectado. Nulo si aún no existe |
| `crmContactId` | `String` | FK a `CrmContact` |
| `tokenUuid` | `String?` | Token reactivado con el que se autorizó |
| `authorizedBy` | `String` | **Obligatorio.** Quién autoriza, enviado por Zoho |
| `reason` | `String?` | Motivo del cambio |
| `source` | `String` | Origen. Por defecto `ZOHO_REACTIVAR` |
| `expiresAt` | `DateTime` | Coincide con la nueva vigencia del enlace |
| `consumedAt` | `DateTime?` | Se sella al crear la versión |
| `consumedByVersionId` | `String?` | Versión que consumió la autorización |

Una autorización sólo sirve si `consumedAt IS NULL` **y** `expiresAt > now()`.

## 4. Cambios en modelos existentes

| Modelo | Cambio |
|---|---|
| `Form` | Nueva columna `currentVersion Int @default(1)` |
| `Form` | Nuevas relaciones `versions`, `editAuthorizations` |
| `CrmContact` | Nueva relación `editAuthorizations` |

No se eliminó ni se renombró ninguna columna: la migración es aditiva.

## 5. Migración de datos

El backfill sella cada `Form` existente como versión 1 con su estado actual.
Es idempotente (`WHERE NOT EXISTS`) y **no borra nada**:

```sql
INSERT INTO "FormVersion" (...)
SELECT gen_random_uuid()::text, f."id", 1, f."data", f."status", ...
FROM "Form" f
WHERE NOT EXISTS (
    SELECT 1 FROM "FormVersion" v WHERE v."formId" = f."id" AND v."version" = 1
);
```

## 6. Contrato de la API de reactivación

`POST /api/reactivar` ahora **exige** el responsable. Sin él responde `400`.

```jsonc
{
  "recordId":    "4876000000123456",   // requerido, ID del registro en Zoho
  "responsable": "ana@cscaballero.com", // requerido, quién autoriza el cambio
  "motivo":      "El cliente corrige la dirección fiscal" // opcional
}
```

Se aceptan `responsible` y `usuario` como alias de `responsable`, y `reason`
como alias de `motivo`.

Respuesta:

```jsonc
{
  "success": true,
  "expiresAt": "2026-10-22T…",
  "authorizationId": "…",   // la autorización creada
  "responsable": "ana@cscaballero.com",
  "motivo": "El cliente corrige la dirección fiscal"
}
```

> **Acción requerida en Zoho CRM:** el botón "Reactivar Enlace" debe incluir
> `responsable` en el cuerpo de la petición. Mientras no lo envíe, la
> reactivación falla con `400` y el enlace **no** se reactiva.

## 7. Flujo completo

```
Cliente envía              -> Form creado + FormVersion v1 (sin responsable)
                              draft.completed = true, token usado
Cliente reenvía            -> bloqueado: "ya fue enviado"

Zoho "Reactivar Enlace"    -> token reactivado (30 días)
  { responsable, motivo }     + FormEditAuthorization pendiente

Cliente edita y reenvía    -> Form actualizado (mismo id)
                              FormVersion v2 con authorizedBy y reason
                              autorización marcada como consumida
                              token usado de nuevo -> vuelve a bloquearse
```

## 8. Consultas útiles

Historial de un expediente:

```sql
SELECT version, "submittedAt", "authorizedBy", "reason", "changedFields"
FROM "FormVersion" WHERE "formId" = $1 ORDER BY version;
```

Reactivaciones que nunca derivaron en un cambio:

```sql
SELECT a."authorizedBy", a."reason", a."createdAt", a."expiresAt"
FROM "FormEditAuthorization" a
WHERE a."consumedAt" IS NULL AND a."expiresAt" < now();
```

## 9. Límites conocidos

- Una autorización habilita una modificación de **todo** el expediente, no de
  campos concretos.
- Las filas relacionales (`GjcMember`, `BfMember`, `LegalRepresentative`,
  `Signature`) reflejan **sólo la versión vigente**; el histórico de esas
  personas vive dentro del `data` de cada `FormVersion`.
- Los documentos en WorkDrive no se versionan: un archivo reemplazado se
  sustituye. La lista de nombres por versión sí queda en `data`.

## 10. Expediente consolidado (PDF) por versión

El PDF consolidado que se sube a WorkDrive se arma **siempre desde la versión
sellada** (`FormVersion.data`), nunca desde el borrador:

```ts
const versionSellada = await prisma.formVersion.findFirst({
  where: { formId: form.id }, orderBy: { version: "desc" },
});
const datosVersion = versionSellada?.data ?? form.data;  // respaldo
```

- El encabezado del PDF muestra **"Versión N"**.
- El archivo se llama `Expediente_Debida_Diligencia_{cliente}_v{N}.pdf`, así una
  enmienda **no pisa** el consolidado de la versión anterior en WorkDrive.
- `WorkDriveSync.syncedVersion` registra qué versión ya está consolidada. La
  sincronización sólo se omite si `syncedVersion >= Form.currentVersion`; tras
  una enmienda el PDF se regenera.
- El listado de documentos **abre siempre en página nueva** y agrupa por
  requisito, enumerando todos los archivos de los campos multi-archivo.
