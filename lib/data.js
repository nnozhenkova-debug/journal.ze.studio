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

export async function getProjectMembers(projectId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('project_members')
    .select('user_id, sort_order, profiles(id,display_name,role,avatar_url)')
    .eq('project_id', projectId)
    .order('sort_order');
  return (data || []).map((m) => m.profiles).filter(Boolean);
}

export async function getProfileById(userId) {
  if (!userId) return null;
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('id,display_name,role,avatar_url').eq('id', userId).maybeSingle();
  return data;
}

// Ретро проекта вместе с краткими именами участников (для строк списка на экране проекта).
export async function listProjectRetros(projectId) {
  const supabase = createClient();
  const { data: retros } = await supabase
    .from('retros')
    .select('*')
    .eq('project_id', projectId)
    .order('scheduled_date', { ascending: false });
  if (!retros || retros.length === 0) return [];
  const ids = retros.map((r) => r.id);
  const { data: participants } = await supabase
    .from('retro_participants')
    .select('retro_id, profiles(display_name)')
    .in('retro_id', ids);
  const namesByRetro = new Map();
  for (const p of participants || []) {
    if (!namesByRetro.has(p.retro_id)) namesByRetro.set(p.retro_id, []);
    if (p.profiles?.display_name) namesByRetro.get(p.retro_id).push(p.profiles.display_name);
  }
  return retros.map((r) => ({ ...r, participantNames: namesByRetro.get(r.id) || [] }));
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

export async function listEvents({ limit, projectId, since } = {}) {
  const supabase = createClient();
  let query = supabase
    .from('events')
    .select('*, projects(id,name,shortcode,color_key)')
    .order('created_at', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);
  if (since) query = query.gte('created_at', since);
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
    .select('*, profiles(id,display_name,avatar_url)')
    .eq('retro_id', retroId)
    .order('created_at');
  return data || [];
}

export async function listActionItems(retroId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('retro_action_items')
    .select('*, profiles(id,display_name,avatar_url)')
    .eq('retro_id', retroId)
    .order('sort_order');
  return data || [];
}

export async function listRetroHighlights(retroId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('retro_highlights')
    .select('*, profiles(id,display_name,avatar_url)')
    .eq('retro_id', retroId)
    .order('sort_order');
  return data || [];
}

export async function listRetroEnergy(retroId) {
  const supabase = createClient();
  const { data } = await supabase.from('retro_energy').select('*').eq('retro_id', retroId);
  return data || [];
}

export async function listRetroParticipants(retroId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('retro_participants')
    .select('*, profiles(id,display_name,role,avatar_url)')
    .eq('retro_id', retroId);
  return data || [];
}
