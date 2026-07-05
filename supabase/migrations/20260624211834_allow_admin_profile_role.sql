-- Alinha o schema remoto com as policies e o frontend, que ja usam role = 'admin'.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('vet', 'tutor', 'admin'));
