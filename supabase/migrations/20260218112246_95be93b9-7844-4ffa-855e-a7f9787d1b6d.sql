
-- 1. Add new status values to obligation_status
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'PLANNED';
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

-- 2. Add PROTOKOL to doc_kind
ALTER TYPE doc_kind ADD VALUE IF NOT EXISTS 'PROTOKOL';

-- 3. Add IMPORTED to history_action
ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'IMPORTED';

-- 4. Create service_catalog table
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division text NOT NULL,
  group_name text NOT NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read catalog" ON public.service_catalog FOR SELECT USING (true);
CREATE POLICY "Admins can manage catalog" ON public.service_catalog FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update catalog" ON public.service_catalog FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete catalog" ON public.service_catalog FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Add new columns to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS room text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS inventory_no text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS extra_json jsonb;

-- 6. Add service_id and quantity to obligations
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.service_catalog(id);
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS quantity integer;

-- 7. Update compute_obligation_status trigger: NO interval calculation
CREATE OR REPLACE FUNCTION public.compute_obligation_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  threshold_days INT;
BEGIN
  -- DO NOT compute next_due_date from periodicity
  -- next_due_date must always be entered manually

  -- Get threshold
  SELECT (value::TEXT)::INT INTO threshold_days FROM public.app_settings WHERE key = 'due_soon_threshold_days';
  IF threshold_days IS NULL THEN threshold_days := 30; END IF;

  -- Keep manually set terminal statuses
  IF NEW.status IN ('DONE', 'ARCHIVED', 'IN_PROGRESS') THEN
    NULL;
  ELSIF NEW.next_due_date IS NULL THEN
    NEW.status := 'NEEDS_INFO';
  ELSIF NEW.next_due_date < CURRENT_DATE THEN
    NEW.status := 'OVERDUE';
  ELSIF NEW.next_due_date <= CURRENT_DATE + (threshold_days || ' days')::INTERVAL THEN
    NEW.status := 'DUE_SOON';
  ELSE
    NEW.status := 'PLANNED';
  END IF;

  RETURN NEW;
END;
$$;

-- 8. Seed service_catalog
INSERT INTO public.service_catalog (division, group_name, code, name) VALUES
-- Revize a inspekce > Revize elektro
('Revize a inspekce', 'Revize elektro', 'RS-SPOT', 'Spotřebiče'),
('Revize a inspekce', 'Revize elektro', 'REI', 'Elektroinstalace'),
('Revize a inspekce', 'Revize elektro', 'RST', 'Strojní zařízení'),
('Revize a inspekce', 'Revize elektro', 'RS-SVAR', 'Svářecí zařízení'),
('Revize a inspekce', 'Revize elektro', 'RNO', 'Nouzové osvětlení'),
('Revize a inspekce', 'Revize elektro', 'REVS', 'Nabíjecí stanice'),
('Revize a inspekce', 'Revize elektro', 'RAP', 'Antistatické podlahy'),
('Revize a inspekce', 'Revize elektro', 'RHROM', 'Hromosvody'),
('Revize a inspekce', 'Revize elektro', 'RFVE', 'Fotovoltaické elektrárny'),
('Revize a inspekce', 'Revize elektro', 'RVN', 'VN a trafostanice'),
('Revize a inspekce', 'Revize elektro', 'TERM', 'Termovizní měření'),
('Revize a inspekce', 'Revize elektro', 'DRON', 'Letecké inspekce'),
-- BOZP a požární ochrana
('BOZP a požární ochrana', 'Bezpečnost práce (BOZP)', 'BOZP', 'Bezpečnost práce (balíček)'),
('BOZP a požární ochrana', 'Bezpečnost práce (BOZP)', 'VPPO', 'Kontroly VPPO, PBZ'),
('BOZP a požární ochrana', 'Bezpečnost práce (BOZP)', 'MPBP', 'Místní provozní bezpečnostní předpis'),
('BOZP a požární ochrana', 'Bezpečnost práce (BOZP)', 'PNV', 'Protokol vnějších vlivů'),
('BOZP a požární ochrana', 'Bezpečnost práce (BOZP)', 'REGZEB', 'Kontroly regálů a žebříků'),
('BOZP a požární ochrana', 'Požární ochrana (PO)', 'PO', 'Požární ochrana (balíček)'),
-- Školení a certifikace
('Školení a certifikace', 'Školení', 'SK-BOZP', 'Školení bezpečnosti práce'),
('Školení a certifikace', 'Školení', 'SK-PO', 'Školení požární ochrany'),
('Školení a certifikace', 'Školení', 'SK-PP', 'Školení první pomoci'),
('Školení a certifikace', 'Školení', 'SK-RIDIC', 'Školení řidičů referentů'),
('Školení a certifikace', 'Školení', 'SK-VYSKA', 'Školení výškových prací'),
('Školení a certifikace', 'Školení', 'SK-SPOT', 'Školení o ochraně spotřebitelem elektro'),
('Školení a certifikace', 'Školení', 'SK-RT', 'Školení revizních techniků'),
('Školení a certifikace', 'Školení', 'SK-ONLINE', 'Školení online kurzy')
ON CONFLICT (code) DO NOTHING;
