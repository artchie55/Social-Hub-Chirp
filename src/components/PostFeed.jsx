import { useEffect, useState } from 'react';
import { supabase } from '../libraries/supabase';

export default function PostFeed() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch posts with proper RLS-compliant query
  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles (
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Verify and set posts
      if (data && Array.isArray(data)) {
        setPosts(data);
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError('Failed to load posts. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Handle post submission with RLS compliance
  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() || !user?.id) return;

    setIsPosting(true);
    setError(null);

    try {
      // Insert new post with the authenticated user's ID
      const { data: newPost, error: insertError } = await supabase
        .from('posts')
        .insert({
          content: newPostContent,
          user_id: user.id
        })
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles (
            username,
            avatar_url
          )
        `)
        .single();

      if (insertError) throw insertError;

      // Optimistically update UI
      setPosts(prevPosts => [newPost, ...prevPosts]);
      setNewPostContent('');
    } catch (err) {
      console.error('Failed to create post:', err);
      setError(err.message || 'Failed to create post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  // Initialize user and profile
  useEffect(() => {
    const initializeUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error('User not authenticated:', error);
        return;
      }

      setUser(user);

      // Ensure profile exists (RLS-compliant)
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            username: user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
            avatar_url: null
          }, { onConflict: 'id' });

        if (profileError) throw profileError;
      } catch (err) {
        console.error('Profile initialization error:', err);
      }
    };

    initializeUser();
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('realtime_posts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts',
        filter: `user_id=eq.${user.id}` // Only get changes for current user's posts
      }, (payload) => {
        console.log('Realtime update:', payload);
        
        switch (payload.eventType) {
          case 'INSERT':
            setPosts(prev => [payload.new, ...prev]);
            break;
          case 'DELETE':
            setPosts(prev => prev.filter(post => post.id !== payload.old.id));
            break;
          case 'UPDATE':
            setPosts(prev => prev.map(post => 
              post.id === payload.new.id ? payload.new : post
            ));
            break;
          default:
            fetchPosts(); // Fallback refresh
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Initial data fetch
  useEffect(() => {
    fetchPosts();
  }, []);

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div id='gradient' className="p-4 max-w-[800px] mx-auto rounded-[7px]">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Social Feed</h1>
        {user && (
          <div className="flex items-center gap-2">
            <span className='font-bold'>Hi, {user.email?.split('@')[0]}</span>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="px-3 py-1 rounded text-sm text-white bg-blue-500 hover:bg-blue-600 cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Post Form */}
      {user && (
        <form onSubmit={handleSubmitPost} className="mb-6 p-4 bg-white rounded-lg shadow">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-2 border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            disabled={isPosting}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPosting || !newPostContent.trim()}
              className={`px-4 py-2 bg-blue-500 text-white rounded ${
                isPosting || !newPostContent.trim() 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-blue-600 cursor-pointer'
              }`}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {/* Posts List */}
      <div className="space-y-4">
        {posts.length > 0 ? (
          posts.map(post => (
            <div key={post.id} className="p-4 bg-white rounded-lg shadow">
              <div className="flex items-center gap-2 mb-2">
                {post.profiles?.avatar_url ? (
                  <img 
                    src={post.profiles.avatar_url}
                    className="w-6 h-6 rounded-full object-cover"
                    alt="User avatar"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                    {post.profiles?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className='text-[14px] font-bold'>
                  @{post.profiles?.username || 'user'}
                </span>
              </div>
              <p className="text-gray-800">{post.content}</p>
              <div className="text-xs text-gray-500 mt-2">
                {new Date(post.created_at).toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <p>{user ? 'No posts yet' : 'Please sign in to view posts'}</p>
            {user && (
              <button 
                onClick={async () => {
                  try {
                    await supabase
                      .from('posts')
                      .insert({
                        content: 'Check out my first post!',
                        user_id: user.id
                      });
                    await fetchPosts();
                  } catch (err) {
                    setError('Failed to create sample post');
                  }
                }}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Create Sample Post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}