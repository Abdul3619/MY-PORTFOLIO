import React, { useState } from 'react';
import { KeyRound, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAdmin } from '../../components/admin/AdminLayout';
import { GlassCard } from '../../components/GlassCard';

const MIN_PASSWORD_LENGTH = 8;

// Account security for the signed-in admin. Only Supabase Auth is touched here; no profile/CMS data is read or written.
export default function AdminAccount() {
  const { user, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const { triggerToast } = useAdmin();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!isPasswordRecovery && !currentPassword) return 'Enter your current password.';
    if (newPassword.length < MIN_PASSWORD_LENGTH) return `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (newPassword !== confirmPassword) return 'The new passwords do not match.';
    if (!isPasswordRecovery && newPassword === currentPassword) return 'The new password must be different from the current one.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user?.email) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setSaving(true);
    try {
      // Re-confirm the current password so an unattended, signed-in browser can't be used to take over the account.
      // Sessions opened from a password-reset email are already verified by that link.
      if (!isPasswordRecovery) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (verifyError) {
          setError('Your current password is incorrect.');
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      clearPasswordRecovery();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Your password has been changed. Use the new password the next time you sign in.');
      triggerToast('Password Updated', 'Your admin password was changed successfully.', 'success');
    } catch (err: any) {
      setError(err?.message || 'The password could not be changed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none focus:border-[#00F0FF]/50 text-sm font-mono';

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Account & Security</h1>
        <p className="text-sm text-gray-400">Manage the password for your admin account.</p>
      </div>

      <GlassCard className="p-6 border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
          <div className="p-2 rounded-lg bg-[#00F0FF]/10 text-[#00F0FF]">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Signed in as</p>
            <p className="text-sm text-white font-mono" data-testid="account-email">{user?.email}</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-[#00F0FF]" /> Change Password
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          {isPasswordRecovery
            ? 'You opened a password-reset link. Choose a new password to finish recovering your account.'
            : `Confirm your current password, then choose a new one (at least ${MIN_PASSWORD_LENGTH} characters).`}
        </p>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div role="status" className="mb-5 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!isPasswordRecovery && (
            <div>
              <label htmlFor="current-password" className="block text-xs font-mono text-gray-400 mb-1">Current password</label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label htmlFor="new-password" className="block text-xs font-mono text-gray-400 mb-1">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-xs font-mono text-gray-400 mb-1">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded-lg hover:bg-[#00F0FF]/20 transition-all font-mono text-xs disabled:opacity-50"
          >
            <KeyRound size={16} /> {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
