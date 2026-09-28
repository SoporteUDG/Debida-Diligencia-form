-- El email del contacto ya no es único: varios expedientes (p. ej. el jurídico y su
-- representante legal) pueden compartir correo. Se conserva el índice no único.
DROP INDEX "CrmContact_email_key";
