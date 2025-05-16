import { useState } from 'react';
import { supabase } from '../libraries/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleAuth = async (type) => {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      // Handle both login and signup
      const { data, error: authError } = type === 'LOGIN'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ 
            email, 
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: {
                username: email.split('@')[0]
              }
            }
          });

      if (authError) throw authError;

      // For signups, show verification message regardless of profile creation
      if (type === 'SIGNUP') {
        setMessage('Verification sent to email! Please check your inbox.');
        
        // Attempt profile creation silently (won't show errors to user)
        try {
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              username: email.split('@')[0] || `user_${data.user.id.slice(0, 8)}`
            }, { onConflict: 'id' });
        } catch (profileError) {
          console.error('Profile creation failed (non-critical):', profileError);
        }
      }

      // Handle login normally
      if (type === 'LOGIN' && data.user) {
        // Ensure profile exists
        try {
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              username: data.user.email?.split('@')[0] || `user_${data.user.id.slice(0, 8)}`
            }, { onConflict: 'id' });
        } catch (profileError) {
          console.error('Profile update failed:', profileError);
        }
      }

    } catch (error) {
      // Only show non-RLS errors to user
      if (!error.message.includes('row-level security policy')) {
        setError(error.message || 'Authentication failed');
      }
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center mt-[-10%] items-center h-screen p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Welcome to Chirp</h1>
        
        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
            {message}
          </div>
        )}

        {/* Auth Form */}
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              minLength={6}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleAuth('LOGIN')}
              disabled={loading}
              className={`flex-1 py-2 px-4 rounded-md font-medium cursor-pointer ${
                loading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => handleAuth('SIGNUP')}
              disabled={loading}
              className={`flex-1 py-2 px-4 rounded-md font-medium cursor-pointer ${
                loading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {loading ? 'Processing...' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}