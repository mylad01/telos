-- Phase C of docs/FEATURES.md: an evening bucket in the Today view.
-- Run once in the Supabase SQL editor after 20261127090000_telos_task_structure.sql.

alter table public.tasks add column if not exists evening boolean not null default false;
