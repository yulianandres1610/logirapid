-- Migration: Add label_logo_url to companies
-- Description: Campo para logo de etiquetas de envío (blanco y negro)
-- separado del logo de empresa (a color)

-- Agregar columna label_logo_url
ALTER TABLE companies ADD COLUMN IF NOT EXISTS label_logo_url TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN companies.label_logo_url IS 'URL del logo para etiquetas de envío (blanco y negro)';
