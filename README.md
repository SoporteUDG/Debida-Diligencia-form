# Documentación Técnica y Manual de Operaciones: Sistema de Debida Diligencia (UDG)

Este repositorio contiene la aplicación web y plataforma administrativa para el formulario de Registro de Debida Diligencia de Grupo Urban Development (UDG), orientada a la recolección, validación, firma digital y almacenamiento estructurado de información de cumplimiento para Personas Naturales y Personas Jurídicas.

---

## Tabla de Contenido

1. [Arquitectura del Sistema](#1-arquitectura-del-sistema)
2. [Requisitos Previos e Instalación Local](#2-requisitos-previos-e-instalación-local)
3. [Variables de Entorno y Gestión de Secretos](#3-variables-de-entorno-y-gestión-de-secretos)
4. [Gestión de Base de Datos y Migraciones](#4-gestión-de-base-de-datos-y-migraciones)
5. [Despliegue y Contenedorización](#5-despliegue-y-contenedorización)
6. [Estrategia de Respaldos y Recuperación](#6-estrategia-de-respaldos-y-recuperación)
7. [Monitoreo, Registros de Auditoría y Salud](#7-monitoreo-registros-de-auditoría-y-salud)
8. [Integraciones con Sistemas Terceros](#8-integraciones-con-sistemas-terceros)
9. [Resolución de Problemas y Diagnóstico](#9-resolución-de-problemas-y-diagnóstico)
10. [Procedimientos de Soporte y Handoff](#10-procedimientos-de-soporte-y-handoff)

---

## 1. Arquitectura del Sistema

La arquitectura está diseñada como una aplicación full-stack monolítica moderna basada en el framework Next.js 16 con App Router, comunicación tipada mediante tRPC y persistencia con Prisma ORM sobre PostgreSQL.

### Componentes Principales

```
+-------------------------------------------------------------------+
|                        CAPA DE PRESENTACIÓN                       |
|  - Next.js 16 (React 19) App Router                               |
|  - Formulario Cliente (Persona Natural / Persona Jurídica)        |
|  - Panel Administrativo de Control y Aprobación                   |
|  - Optimización: Dynamic Imports, CSS Vanilla                     |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|                        CAPA DE NEGOCIO / API                      |
|  - tRPC Router (Procedimientos protegidos por Token y JWT)        |
|  - Servicio de Autenticación y Cifrado (JWT, bcrypt)               |
|  - Generador de Documentación PDF (jsPDF / html2canvas)           |
|  - Motor de Registro de Auditoría (AuditLog Service)              |
+---------------------------------+---------------------------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------+-----------------------+   +---------------+---------------+
|    PERSISTENCIA Y DATOS LOCALES   |   |    INTEGRACIONES DE TERCEROS   |
|  - PostgreSQL Database            |   |  - Zoho CRM (API v2)          |
|  - Prisma ORM 7.x                 |   |  - Zoho WorkDrive (Stream API)|
|  - LocalStorage / Memory Drafts   |   |  - SAP B1 (Service Layer)     |
+-----------------------------------+   +-------------------------------+
```

### Tecnologías Empleadas

- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS, Lucide Icons, jsPDF.
- **Backend / API**: tRPC v11, Next.js Server Actions y API Routes.
- **Persistencia**: PostgreSQL 15+, Prisma ORM.
- **Gestión de Paquetes**: PNPM v9.x (fijado en entorno de compilación Docker).
- **Contenedorización**: Docker (Node 22-slim) y despliegue automatizado en Dokploy.

---

## 2. Requisitos Previos e Instalación Local

### Requisitos del Sistema

- Node.js >= 20.x LTS
- PNPM >= 9.x
- PostgreSQL Server >= 15.0
- Git

### Pasos de Instalación

1. Clonar el repositorio de código fuente:
   ```bash
   git clone https://github.com/SoporteUDG/Debida-Diligencia-form.git
   cd Debida-Diligencia-form
   ```

2. Instalar dependencias del proyecto:
   ```bash
   pnpm install
   ```

3. Configurar el archivo de variables de entorno copiando la plantilla base:
   ```bash
   cp .env.example .env
   ```

4. Generar el cliente de Prisma e inicializar la base de datos:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Ejecutar la semilla inicial de base de datos (creación de usuarios administradores por defecto):
   ```bash
   npx prisma db seed
   ```

6. Iniciar el servidor de desarrollo local:
   ```bash
   pnpm dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

---

## 3. Variables de Entorno y Gestión de Secretos

El archivo `.env` almacena la configuración de conexión y las credenciales de integraciones. **Bajo ninguna circunstancia se deben subir credenciales ni secretos reales al control de versiones (Git)**.

### Diccionario de Variables de Entorno

| Variable | Descripción | Ejemplo / Valor por Defecto |
| :--- | :--- | :--- |
| `DATABASE_URL` | URI de conexión a la base de datos PostgreSQL | `postgresql://user:password@localhost:5432/debida_db` |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT de sesión | `super-secret-key-change-in-production` |
| `NEXT_PUBLIC_APP_URL` | URL pública base de la aplicación | `https://debida.udg.com.pa` |
| `ZOHO_CLIENT_ID` | Client ID de la app registrada en Zoho Developer Console | `1000.XXXXXXXXXXXXXXXXXXXXXXXX` |
| `ZOHO_CLIENT_SECRET` | Client Secret de la aplicación en Zoho | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `ZOHO_REFRESH_TOKEN` | Refresh Token OAuth 2.0 de Zoho con permisos CRM y WorkDrive | `1000.xxxxxxxxxxxxxxxx.xxxxxxxx` |
| `ZOHO_ACCOUNTS_URL` | Endpoint de autenticación OAuth de Zoho | `https://accounts.zoho.com` |
| `ZOHO_CRM_BASE_URL` | Endpoint base para API REST de Zoho CRM | `https://www.zohoapis.com/crm/v2` |
| `ZOHO_WORKDRIVE_BASE_URL` | Endpoint base para API REST de Zoho WorkDrive | `https://www.zohoapis.com/workdrive/api/v1` |
| `ZOHO_UPLOAD_BASE_URL` | Endpoint base para API de Stream Upload de WorkDrive | `https://upload.zoho.com` |
| `ZOHO_WORKDRIVE_ROOT_FOLDER_ID` | ID de la carpeta raíz de destino en WorkDrive | `xxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SAP_SERVICE_LAYER_URL` | Endpoint base del Service Layer de SAP Business One | `https://sap.udg.com.pa:50000/b1s/v1` |
| `SAP_COMPANY_DB` | Nombre de la base de datos de la empresa en SAP | `UDG_PROD` |
| `SAP_USERNAME` | Usuario de servicio para SAP Service Layer | `api_user` |
| `SAP_PASSWORD` | Contraseña del usuario de servicio de SAP | `secure_password` |

### Procedimiento de Rotación de Secretos

1. **Rotación de Refresh Token de Zoho**: Generar un nuevo grant code en Zoho Developer Console y solicitar el nuevo `refresh_token`. Actualizar la variable en la consola de Dokploy/Servidor y reiniciar el contenedor.
2. **Rotación de JWT_SECRET**: Cambiar el valor en el entorno de producción. Notar que esto invalidará las sesiones activas de los usuarios administradores, obligándoles a iniciar sesión nuevamente.

---

## 4. Gestión de Base de Datos y Migraciones

La aplicación utiliza Prisma ORM para gestionar el esquema de la base de datos PostgreSQL.

### Comandos Principales de Base de Datos

- **Generar cliente de Prisma**:
  ```bash
  npx prisma generate
  ```

- **Crear y aplicar una nueva migración en desarrollo**:
  ```bash
  npx prisma migrate dev --name <nombre_descriptivo_cambio>
  ```

- **Aplicar migraciones pendientes en entorno de producción**:
  ```bash
  npx prisma migrate deploy
  ```

- **Ejecutar seed de datos iniciales (Usuarios administradores)**:
  ```bash
  npx prisma db seed
  ```

### Estructura de Tablas Principales

- `AdminUser`: Usuarios administradores del sistema con roles (`SUPERADMIN`, `ADMIN`, `USER`).
- `CrmContact`: Contactos sincronizados desde Zoho CRM.
- `Form`: Expedientes de formularios completados y enviados.
- `Draft`: Borradores parciales de formularios en formato JSONB con autoguardado.
- `Document`: Registro de documentos adjuntos asociados a borradores o expedientes enviados (guarda identificadores remotos `zohoFileId` y URLs de compartición).
- `WorkDriveSync` / `CrmSync` / `SapSync`: Tablas de estado de sincronización con sistemas externos.
- `AuditLog`: Registro detallado de eventos de seguridad y operaciones del sistema.

---

## 5. Despliegue y Contenedorización

El despliegue se gestiona a través de Docker y la plataforma de orquestación Dokploy.

### Archivo Dockerfile (Multi-stage Build)

El proyecto incluye un `Dockerfile` optimizado en dos etapas (Build Stage y Runner Stage):

- **Imagen Base**: `node:22-slim`
- **Paquetes de Sistema**: `openssl` (requerido para el motor de Prisma)
- **Gestor de Paquetes**: `pnpm@9` (fijado explícitamente a versión 9 para mantener compatibilidad estricta de permisos de scripts de compilación).

### Proceso de Compilación en Servidor

```dockerfile
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-lock.yaml* .npmrc ./
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build
```

### Script de Inicio (`start.sh`)

Al iniciar el contenedor de producción, el script `start.sh` ejecuta la aplicación en modo Standalone:

```bash
#!/bin/sh
set -e
echo "Ejecutando migraciones de base de datos..."
npx prisma migrate deploy || true
echo "Iniciando servidor Next.js..."
exec node server.js
```

---

## 6. Estrategia de Respaldos y Recuperación

### 1. Respaldos de Base de Datos PostgreSQL

Se debe configurar una tarea programada (Cron Job) en el servidor de base de datos para realizar respaldos diarios mediante `pg_dump`:

```bash
pg_dump -h localhost -U postgres -d debida_db -F c -b -v -f "/backups/debida_db_$(date +%Y%m%m_%H%M%S).dump"
```

**Retención recomendada**:
- Respaldos diarios durante 30 días.
- Respaldos mensuales durante 12 meses.

### 2. Recuperación de Documentos y Archivos

Los archivos físicos cargados por los usuarios **no se almacenan localmente en el disco del servidor de aplicaciones**, sino que se transmiten directamente hacia la infraestructura de **Zoho WorkDrive** organizada en la estructura `/DD/{AÑO}/{MES}/{APELLIDO_NOMBRE_ID}/`.
En caso de falla del servidor web o de la base de datos local, la documentación del cliente permanece resguardada y accesible en la nube de Zoho.

---

## 7. Monitoreo, Registros de Auditoría y Salud

### Registros de Auditoría (`AuditLog`)

Cada acción crítica realizada en el sistema (inicio de sesión, generación de enlaces, carga de documentos, aprobación o rechazo de expedientes) queda registrada en la tabla `AuditLog` con la siguiente información:

- Acción realizada (`action`)
- Entidad afectada y su identificador (`entityName`, `entityId`)
- Usuario o administrador responsable (`userId`)
- Dirección IP y agente de usuario (`ipAddress`, `userAgent`)
- Detalles técnicos en formato JSON (`details`)

### Monitoreo de Aplicación

- **Salud del Servidor**: Inspeccionar logs de contenedor vía Dokploy o Docker CLI:
  ```bash
  docker logs -f <nombre_contenedor>
  ```
- **Puntos de Falla de Red / APIs**: El servicio de autenticación de Zoho (`zohoAuthService.ts`) cuenta con un envoltorio de reintento automático (`executeWithRetry`) que captura errores HTTP 401 e invalida automáticamente el token en caché para renovarlo.

---

## 8. Integraciones con Sistemas Terceros

### 1. Zoho CRM (API REST v2)

- **Propósito**: Consulta de datos de contactos/leads, actualización del estado del expediente y registro de enlaces del formulario.
- **Autenticación**: OAuth 2.0 mediante Refresh Token.
- **Módulos Consultados/Actualizados**: `Contacts`, `Leads`, `Debida_Diligencia`.

### 2. Zoho WorkDrive (Stream Upload API & Share Links)

- **Propósito**: Almacenamiento organizado de adjuntos (cédulas, pactos sociales, avisos de operación, estados financieros).
- **Proceso de Subida**:
  1. Validación del archivo local mediante comprobación de firma binaria (*magic bytes*) para PDF y JPG/JPEG (límite 10 MB).
  2. Búsqueda o creación idempotente de carpetas: `/DD/{AÑO}/{MES}/{APELLIDO_NOMBRE_ID}/{TIPO_DOCUMENTO}/`.
  3. Transmisión del archivo binario a la API de Stream Upload (`upload.zoho.com`).
  4. Generación de enlace de lectura/descarga pública (`createShareLink`) guardado en la base de datos PostgreSQL.

### 3. SAP Business One (Service Layer)

- **Propósito**: Sincronización final de información del cliente y creación/actualización de Socios de Negocios (Business Partners).
- **Endpoint**: Service Layer HTTPS.

---

## 9. Resolución de Problemas y Diagnóstico

### Errores Frecuentes y Soluciones

#### 1. `ERR_PNPM_IGNORED_BUILDS` o Fallo en la etapa de `pnpm install` durante el build en Docker
- **Causa**: Versiones recientes de PNPM (v10+) bloquean la ejecución de scripts de compilación de paquetes nativos como `@prisma/engines` o `sharp`.
- **Solución**: Asegurar que el `Dockerfile` contenga explícitamente `RUN npm install -g pnpm@9` y que el archivo `.npmrc` esté incluido en la instrucción `COPY`.

#### 2. `Zoho API Error: 401 Unauthorized` o Token Expirado
- **Causa**: El token de acceso OAuth expiró o el `ZOHO_REFRESH_TOKEN` fue revocado en Zoho Developer Console.
- **Solución**: Verificar la validez del refresh token en `.env`. La función `executeWithRetry` limpia la caché del token automáticamente e intenta re-autenticar.

#### 3. Error al Subir Archivo: `Discrepancia de extensión de archivo`
- **Causa**: El usuario intentó subir un archivo cuyo tipo MIME detectado por sus *magic bytes* no coincide con la extensión declarada (ejemplo: un ejecutable `.exe` renombrado a `.pdf`).
- **Solución**: El sistema rechaza la carga por motivos de seguridad. El usuario debe adjuntar un documento PDF o imagen JPEG legítimo.

---

## 10. Procedimientos de Soporte y Handoff

### Niveles de Escalabilidad de Soporte

- **Nivel 1 (Soporte Operativo / Administración UDG)**: Gestión de usuarios administradores, generación manual de enlaces para clientes, revisión de documentos cargados en el panel administrativo.
- **Nivel 2 (Administración de Infraestructura / DevOps)**: Monitoreo de contenedores en Dokploy, revisión de espacio en base de datos PostgreSQL, verificación de estado de servicios en Zoho y SAP.
- **Nivel 3 (Ingeniería de Software / Desarrollo)**: Mantenimiento del código fuente, actualización de dependencias, ajustes en esquemas de Prisma o lógica de integraciones API.

### Tareas de Mantenimiento Periódico

1. **Revisión Mensual de Logs**: Inspeccionar registros de auditoría en la tabla `AuditLog` para detectar intentos fallidos recurrentes o anomalías de acceso.
2. **Pruebas de Integración**: Ejecutar la suite completa de pruebas unitarias y de integración previa a cualquier actualización en producción:
   ```bash
   pnpm run test
   ```
3. **Verificación de Compilación**: Validar el tipado de TypeScript y la construcción del proyecto antes de realizar un push a la rama principal:
   ```bash
   npx tsc --noEmit
   pnpm run build
   ```

---

*Documento de transferencia técnica generado para el proyecto Formulario de Registro de Debida Diligencia - Grupo Urban Development (UDG).*
