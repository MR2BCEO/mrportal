
-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'pm');
CREATE TYPE public.customer_type AS ENUM ('firma', 'instituce', 'fo');
CREATE TYPE public.obligation_domain AS ENUM ('REVIZE', 'BOZP', 'PO');
CREATE TYPE public.obligation_status AS ENUM ('DRAFT', 'ACTIVE', 'DUE_SOON', 'OVERDUE', 'DONE', 'NEEDS_INFO', 'ARCHIVED');
CREATE TYPE public.doc_kind AS ENUM ('REVIZNI_ZPRAVA', 'FOTO', 'JINE');
CREATE TYPE public.history_action AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'DOCUMENT_ADDED', 'COMMENT');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper functions for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_pm(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'pm')
  )
$$;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "System can insert profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- User roles RLS
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin') AND user_id != auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ObligationType (katalog)
CREATE TABLE public.obligation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain obligation_domain NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_periodicity_months INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obligation_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read types" ON public.obligation_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage types" ON public.obligation_types FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update types" ON public.obligation_types FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete types" ON public.obligation_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ico TEXT,
  dic TEXT,
  type customer_type NOT NULL DEFAULT 'firma',
  tags TEXT[],
  billing_address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read customers" ON public.customers FOR SELECT TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.is_admin_or_pm(auth.uid()));

-- Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role_title TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read contacts" ON public.contacts FOR SELECT TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.is_admin_or_pm(auth.uid()));

-- Locations
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_line TEXT,
  city TEXT,
  zip TEXT,
  country TEXT NOT NULL DEFAULT 'CZ',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read locations" ON public.locations FOR SELECT TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can insert locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can update locations" ON public.locations FOR UPDATE TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can delete locations" ON public.locations FOR DELETE TO authenticated USING (public.is_admin_or_pm(auth.uid()));

-- Assets
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_code TEXT,
  category TEXT,
  manufacturer TEXT,
  serial_number TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read assets" ON public.assets FOR SELECT TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can insert assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can update assets" ON public.assets FOR UPDATE TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can delete assets" ON public.assets FOR DELETE TO authenticated USING (public.is_admin_or_pm(auth.uid()));

-- Obligations
CREATE TABLE public.obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  domain obligation_domain NOT NULL,
  obligation_type_id UUID NOT NULL REFERENCES public.obligation_types(id),
  title TEXT NOT NULL,
  performed_date DATE,
  periodicity_months INT,
  next_due_date DATE,
  status obligation_status NOT NULL DEFAULT 'DRAFT',
  responsible_user_id UUID REFERENCES public.profiles(id),
  technician_name TEXT,
  technician_company TEXT,
  technician_phone TEXT,
  technician_email TEXT,
  findings_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read obligations" ON public.obligations FOR SELECT TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can insert obligations" ON public.obligations FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can update obligations" ON public.obligations FOR UPDATE TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can delete obligations" ON public.obligations FOR DELETE TO authenticated USING (public.is_admin_or_pm(auth.uid()));

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES public.obligations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  uploaded_by_user_id UUID REFERENCES public.profiles(id),
  doc_kind doc_kind NOT NULL DEFAULT 'JINE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read documents" ON public.documents FOR SELECT TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can delete documents" ON public.documents FOR DELETE TO authenticated USING (public.is_admin_or_pm(auth.uid()));

-- Obligation History (audit trail)
CREATE TABLE public.obligation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES public.obligations(id) ON DELETE CASCADE,
  action history_action NOT NULL,
  payload JSONB,
  actor_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obligation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read history" ON public.obligation_history FOR SELECT TO authenticated USING (public.is_admin_or_pm(auth.uid()));
CREATE POLICY "System can insert history" ON public.obligation_history FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pm(auth.uid()));

-- Settings table
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES ('due_soon_threshold_days', '30');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_obligations_updated_at BEFORE UPDATE ON public.obligations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_obligation_types_updated_at BEFORE UPDATE ON public.obligation_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trail trigger for obligations
CREATE OR REPLACE FUNCTION public.log_obligation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.obligation_history (obligation_id, action, payload, actor_user_id)
    VALUES (NEW.id, 'CREATED', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.obligation_history (obligation_id, action, payload, actor_user_id)
      VALUES (NEW.id, 'STATUS_CHANGED', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status), auth.uid());
    ELSE
      INSERT INTO public.obligation_history (obligation_id, action, payload, actor_user_id)
      VALUES (NEW.id, 'UPDATED', jsonb_build_object('changes', to_jsonb(NEW)), auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER obligation_audit_trail
  AFTER INSERT OR UPDATE ON public.obligations
  FOR EACH ROW EXECUTE FUNCTION public.log_obligation_change();

-- Obligation status computation trigger
CREATE OR REPLACE FUNCTION public.compute_obligation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  threshold_days INT;
BEGIN
  -- Compute next_due_date if not provided
  IF NEW.next_due_date IS NULL AND NEW.periodicity_months IS NOT NULL AND NEW.performed_date IS NOT NULL THEN
    NEW.next_due_date := NEW.performed_date + (NEW.periodicity_months || ' months')::INTERVAL;
  END IF;

  -- Get threshold
  SELECT (value::TEXT)::INT INTO threshold_days FROM public.app_settings WHERE key = 'due_soon_threshold_days';
  IF threshold_days IS NULL THEN threshold_days := 30; END IF;

  -- Compute status based on data completeness and dates
  IF NEW.status = 'ARCHIVED' OR NEW.status = 'DONE' THEN
    -- Keep manually set terminal statuses
    NULL;
  ELSIF NEW.performed_date IS NULL OR NEW.next_due_date IS NULL THEN
    IF NEW.periodicity_months IS NULL AND NEW.next_due_date IS NULL AND NEW.performed_date IS NOT NULL THEN
      -- One-time obligation, keep ACTIVE
      NEW.status := 'ACTIVE';
    ELSE
      NEW.status := 'NEEDS_INFO';
    END IF;
  ELSIF NEW.next_due_date < CURRENT_DATE THEN
    NEW.status := 'OVERDUE';
  ELSIF NEW.next_due_date <= CURRENT_DATE + (threshold_days || ' days')::INTERVAL THEN
    NEW.status := 'DUE_SOON';
  ELSE
    NEW.status := 'ACTIVE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER compute_obligation_status_trigger
  BEFORE INSERT OR UPDATE ON public.obligations
  FOR EACH ROW EXECUTE FUNCTION public.compute_obligation_status();

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Auth users can upload docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can read docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND public.is_admin_or_pm(auth.uid()));
CREATE POLICY "Auth users can delete docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.is_admin_or_pm(auth.uid()));

-- Indexes
CREATE INDEX idx_obligations_customer ON public.obligations(customer_id);
CREATE INDEX idx_obligations_location ON public.obligations(location_id);
CREATE INDEX idx_obligations_status ON public.obligations(status);
CREATE INDEX idx_obligations_next_due ON public.obligations(next_due_date);
CREATE INDEX idx_obligations_domain ON public.obligations(domain);
CREATE INDEX idx_locations_customer ON public.locations(customer_id);
CREATE INDEX idx_contacts_customer ON public.contacts(customer_id);
CREATE INDEX idx_assets_location ON public.assets(location_id);
CREATE INDEX idx_documents_obligation ON public.documents(obligation_id);
CREATE INDEX idx_obligation_history_obligation ON public.obligation_history(obligation_id);
