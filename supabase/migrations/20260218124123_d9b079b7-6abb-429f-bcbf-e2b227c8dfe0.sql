-- Add check constraint for name length >= 3
ALTER TABLE public.locations ADD CONSTRAINT chk_location_name_length CHECK (length(trim(name)) >= 3);

-- Add check constraint for city length >= 2
ALTER TABLE public.locations ADD CONSTRAINT chk_location_city_length CHECK (length(trim(city)) >= 2);