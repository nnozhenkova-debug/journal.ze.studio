'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';

export default function SignOutButton({ className }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" className={className} onClick={handleSignOut} title="Выйти">
      Выйти
    </button>
  );
}
