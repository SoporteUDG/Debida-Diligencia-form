/**
 * Traduce el texto visible de una opción sin cambiar el valor que se guarda.
 *
 * El valor guardado en el formulario es siempre el texto en español
 * (condicionales, PDF y Zoho dependen de él). `group` es el grupo de opciones
 * de es.json y `t` el traductor de ese mismo grupo: se busca la clave cuyo
 * texto en español coincide con el valor y se muestra su traducción.
 *
 * @example
 * const tCivil = useTranslations("NaturalForm.NaturalFormStep1OptionFields.civilOptions");
 * const civilLabel = optionLabeler(es.NaturalForm.NaturalFormStep1OptionFields.civilOptions, tCivil);
 * <option value="Casado">{civilLabel("Casado")}</option>
 */
export function optionLabeler(
  group: Record<string, string>,
  t: (key: any) => string
): (value: string) => string {
  const keyByValue = new Map<string, string>();
  for (const [key, value] of Object.entries(group)) {
    if (value) keyByValue.set(value, key);
  }
  return (value: string) => {
    const key = keyByValue.get(value);
    return key ? t(key) : value;
  };
}
