import { useState, useEffect } from 'react'
import { supabase } from './libraries/supabase'
import Auth from './components/Auth'
import PostFeed from './components/PostFeed'

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      {!session ? <Auth /> : <PostFeed key={session.user.id} />}
    </div>
  )
}