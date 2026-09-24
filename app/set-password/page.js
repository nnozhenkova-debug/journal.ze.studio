import { getCurrentUser } from '../../lib/data';
import SetPasswordForm from '../../components/SetPasswordForm';

export const dynamic = 'force-dynamic';

export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  return <SetPasswordForm email={user?.email} />;
}
