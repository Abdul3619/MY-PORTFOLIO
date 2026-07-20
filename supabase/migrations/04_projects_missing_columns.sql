-- Migration: Add missing columns to projects table to support rich metadata directly in first-class columns
-- This matches the requirements of the Portfolio Management System.

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS long_description TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS completion_date TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
