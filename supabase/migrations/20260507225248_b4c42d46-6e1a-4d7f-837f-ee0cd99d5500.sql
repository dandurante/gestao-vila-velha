DROP POLICY IF EXISTS "Anyone can update freelancer registry" ON public.freelancer_registry;
DROP POLICY IF EXISTS "Anyone can delete freelancer registry" ON public.freelancer_registry;

CREATE POLICY "Only admin can update freelancer registry"
ON public.freelancer_registry
FOR UPDATE
USING ((auth.jwt() ->> 'email') = 'dandurante@hotmail.com');

CREATE POLICY "Only admin can delete freelancer registry"
ON public.freelancer_registry
FOR DELETE
USING ((auth.jwt() ->> 'email') = 'dandurante@hotmail.com');