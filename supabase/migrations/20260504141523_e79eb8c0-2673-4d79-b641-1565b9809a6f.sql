-- Restringir exclusão de lançamentos (freelancers) apenas ao admin
DROP POLICY IF EXISTS "Anyone can delete freelancers" ON public.freelancers;

CREATE POLICY "Only admin can delete freelancers"
ON public.freelancers
FOR DELETE
USING (
  (auth.jwt() ->> 'email') = 'dandurante@hotmail.com'
);