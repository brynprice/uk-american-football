'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess, PERMISSION_METADATA } from '@/lib/auth/permissions'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const rawNext = formData.get('next') as string | null
  let next = rawNext || '/admin'

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`)
  }

  // If no explicit next URL was requested and the user is a scoped contributor with a single tool (e.g. Poll Voter),
  // take them directly to that tool.
  if ((!rawNext || rawNext === '/admin') && data?.user) {
    const access = getUserAccess(data.user)
    if (!access.isAdmin && access.permissions.length === 1) {
      const onlyPerm = access.permissions[0]
      if (PERMISSION_METADATA[onlyPerm]) {
        next = PERMISSION_METADATA[onlyPerm].href
      }
    }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
