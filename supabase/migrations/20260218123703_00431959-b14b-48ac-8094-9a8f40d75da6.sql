-- Add partial unique index on ico (only when not null/empty)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_ico_unique 
ON public.customers (ico) 
WHERE ico IS NOT NULL AND ico != '';