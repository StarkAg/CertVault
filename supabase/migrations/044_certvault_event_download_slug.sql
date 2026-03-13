-- Add download_slug to certvault_events for public certificate download pages
-- e.g. /certvault/hize where "hize" is the download_slug
ALTER TABLE public.certvault_events
ADD COLUMN IF NOT EXISTS download_slug TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certvault_events_download_slug
ON public.certvault_events(download_slug) WHERE download_slug IS NOT NULL;

COMMENT ON COLUMN public.certvault_events.download_slug IS 'Public slug for student download page, e.g. gradex.bond/certvault/hize';
