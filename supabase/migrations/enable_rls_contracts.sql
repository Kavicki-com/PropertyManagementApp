-- Enable RLS on contracts table
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to be safe and idempotent)
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can create their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can delete their own contracts" ON public.contracts;

-- Create policy for SELECT
CREATE POLICY "Users can view their own contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for INSERT
CREATE POLICY "Users can create their own contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for UPDATE
CREATE POLICY "Users can update their own contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for DELETE
CREATE POLICY "Users can delete their own contracts"
ON public.contracts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
