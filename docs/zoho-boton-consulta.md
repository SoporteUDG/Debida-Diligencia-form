# Consulta de expedientes desde Zoho CRM

Hay dos formas de ver un expediente en solo lectura:

| Página | Dónde | Cómo recibe el expediente |
|---|---|---|
| `/view` | Web Tab dentro de Zoho CRM | Se pega el enlace del formulario |
| `/expediente?link=<enlace>` | Pestaña aparte del navegador | El botón del Canvas pasa el enlace del registro |

Ambas muestran lo mismo (incluido el historial de versiones). `/expediente` no se
puede embeber en un iframe y no muestra el formulario para pegar enlaces.

## Web Tab

URL: `https://debida-diligencia.udggroup.com/view` (sin parámetros).

## Botón del Canvas → `/expediente`

El Client Script del Canvas no puede abrir URLs externas (`window` no existe en
su entorno), así que el botón es un **botón personalizado de tipo URL**, que Zoho
abre en una pestaña nueva sustituyendo los campos del registro:

1. *Setup → Customization → Modules → Debida Diligencia → Links and Buttons →
   New Button*.
2. Acción: **Open URL** / **Invoke URL**.
3. URL (insertar el campo con el selector de merge fields de Zoho):

   ```
   https://debida-diligencia.udggroup.com/expediente?link=${Debida_Diligencia.Enlace Formulario}
   ```

   El campo es el que guarda "Generar enlace" (`Enlace_Formulario`,
   `Enlace_Debida_Diligencia` o `Enlace_de_Formulario`, según el módulo).
4. En el Canvas, asignar ese botón al elemento botón.

`/expediente` toma todo lo que sigue a `link=`, así que el enlace puede ir sin
codificar aunque contenga su propio `?token=`. También acepta `?token=<token>`.
