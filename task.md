# Tareas de Ejecución: Autenticación Administrativa y Generación de Enlace Seguro

- [x] Implementar hashing de contraseñas PBKDF2 y firmas de sesión HMAC en `src/lib/authService.ts`
- [x] Crear ruta de login `/api/admin/login` con auto-seeding de credenciales de desarrollo (`admin@udg.com` / `admin123`)
- [x] Crear ruta de logout `/api/admin/logout` para limpiar la cookie de sesión
- [x] Implementar Next.js `src/middleware.ts` para proteger rutas administrativas
- [x] Diseñar página de inicio de sesión premium en `/admin/login/page.tsx`
- [x] Implementar modal "Generar Enlace" con búsqueda en Zoho CRM en el dashboard `/admin/page.tsx`
- [x] Integrar visualización de borradores (status `"DRAFT"`) en la tabla e inspector de detalles
- [x] Agregar botón de Cerrar Sesión en el panel de control
- [x] Modificar y ampliar pruebas unitarias en `src/lib/__tests__/adminRouter.test.ts`
- [x] Ejecutar suite de pruebas unitarias (`pnpm run test`)
- [x] Validar consistencia y tipado estático (`npx tsc --noEmit`)
- [x] Verificación: Validar funcionamiento (redirección no autenticada, acceso denegado por rol y compilación de producción) de Next.js (`pnpm run build`)
