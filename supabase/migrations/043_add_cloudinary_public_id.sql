-- Add cloudinary_public_id to certvault_certificates if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'certvault_certificates' 
    AND column_name = 'cloudinary_public_id'
  ) THEN
    ALTER TABLE public.certvault_certificates 
    ADD COLUMN cloudinary_public_id TEXT;
    
    COMMENT ON COLUMN public.certvault_certificates.cloudinary_public_id 
    IS 'Cloudinary public_id for PDF storage and deletion';
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_certvault_certificates_cloudinary_public_id 
ON public.certvault_certificates(cloudinary_public_id);
