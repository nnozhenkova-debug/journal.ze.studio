import { createClient } from './supabase/server';

// Серверные функции чтения данных для страниц (App Router server components).
// Пишущие действия выполняются из клиентских компонентов через lib/supabase/client.

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const supabase = createClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data;
}

export async function listProfiles() {
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').order('display_name');
  return data || [];
}

export async function listProjects({ status = 'active' } = {}) {
  const supabase = createClient();
  let query = supabase.from('projects').select('*').order('name');
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return data || [];
}

export async function getProject(id) {
  const supabase = createClient();
  const { data } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function listStages(projectId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('project_stages')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');
  return data || [];
}

export async function getCurrentStage(projectId) {
  const stages = await listStages(projectId);
  return stages.find((s) => s.state === 'current') || null;
}

export async function listIssues({ status, projectId, limit } = {}) {
  const supabase = createClient();
  let query = supabase
    .from('issues')
    .select('*, projects(id,name,shortcode,color_key)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (projectId) query = query.eq('project_id', projectId);
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return data || [];
}

export async function getIssue(id) {
  const supabase = createClient();
  const { data } = await supabase
    .from('issues')
    .select('*, projects(id,name,shortcode,color_key)')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function listEvents({ limit, projectId } = {}) {
  const supabase = createClient();
  let query = supabase
    .from('events')
    .select('*, projects(id,name,shortcode,color_key)')
    .order('created_at', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return data || [];
}

export async function listRetros({ from, to, projectId, status } = {}) {
  const supabase = createClient();
  let query = supabase
    .from('retros')
    .select('*, projects(id,name,shortcode,color_key)')
    .order('scheduled_date');
  if (from) query = query.gte('scheduled_date', from);
  if (to) query = query.lte('scheduled_date', to);
  if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return data || [];
}

export async function getRetro(id) {
  const supabase = createClient();
  const { data } = await supabase
    .from('retros')
    .select('*, projects(id,name,shortcode,color_key), project_stages(*)')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function listRetroNotes(retroId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('retro_notes')
    .select('*, profiles(id,display_name)')
    .eq('retro_id', retroId)
    .order('created_at');
  return data || [];
}

export async function listRetroParticipants(retroId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('retro_participants')
    .select('*, profiles(id,display_name,role)')
    .eq('retro_id', retroId);
  return data || [];
}
