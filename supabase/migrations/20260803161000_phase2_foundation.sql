-- Migration: 20260803161000_phase2_foundation.sql
-- Description: Memory System Enhancements (Tags & Relationships), App Logs table, and Universal Search indexes

-- Add summary and source columns to memories table if not existing
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'chat';

-- 1. Memory Tags table
CREATE TABLE IF NOT EXISTS public.memory_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_tags TO authenticated;
GRANT ALL ON public.memory_tags TO service_role;
ALTER TABLE public.memory_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own memory tags" ON public.memory_tags FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Memory Relationships table (linking memories together)
CREATE TABLE IF NOT EXISTS public.memory_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_memory_id UUID NOT NULL REFERENCES public.memories ON DELETE CASCADE,
  target_memory_id UUID NOT NULL REFERENCES public.memories ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'related', -- e.g., 'related', 'supersedes', 'derived_from'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_memory_id, target_memory_id, relationship_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_relationships TO authenticated;
GRANT ALL ON public.memory_relationships TO service_role;
ALTER TABLE public.memory_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own memory relationships" ON public.memory_relationships FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Central Application & AI Logs table
CREATE TABLE IF NOT EXISTS public.app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info', -- 'debug', 'info', 'warn', 'error'
  category TEXT NOT NULL, -- 'ai_request', 'tool_call', 'database', 'provider', 'error'
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.app_logs TO authenticated;
GRANT ALL ON public.app_logs TO service_role;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own logs" ON public.app_logs FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE INDEX IF NOT EXISTS app_logs_created_at_idx ON public.app_logs (created_at DESC);
