DROP POLICY IF EXISTS "Admins delete freelancers" ON public.freelancers;
DROP POLICY IF EXISTS "Authenticated delete freelancers" ON public.freelancers;

CREATE POLICY "Authenticated delete freelancers"
ON public.freelancers
FOR DELETE
TO authenticated
USING (true);