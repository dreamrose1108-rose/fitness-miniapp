CREATE TABLE IF NOT EXISTS public.fit_water_records (id text PRIMARY KEY, data jsonb NOT NULL);
ALTER TABLE public.fit_water_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fit_water_records FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS fit_water_owner_date ON public.fit_water_records ((data->>'openid'),(data->>'date'));
CREATE UNIQUE INDEX IF NOT EXISTS fit_water_request ON public.fit_water_records ((data->>'openid'),(data->>'requestId'));
