import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getRequiredPermissionForPath,
  hasPermission,
  isSuperAdmin,
} from '@/lib/auth/permissions'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshing the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Protect /admin and /api/admin routes
  if (pathname.startsWith('/api/admin')) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reqPerm = getRequiredPermissionForPath(pathname)
    if (reqPerm === 'admin_only' && !isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Super Admin required' }, { status: 403 })
    }
    if (reqPerm && reqPerm !== 'admin_only' && reqPerm !== 'any_authenticated') {
      if (!hasPermission(user, reqPerm)) {
        return NextResponse.json({ error: `Forbidden: Missing '${reqPerm}' permission` }, { status: 403 })
      }
    }
  } else if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      // Keep track of the original page to redirect back after login
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const reqPerm = getRequiredPermissionForPath(pathname)
    if (reqPerm === 'admin_only' && !isSuperAdmin(user)) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      url.searchParams.set('denied', 'admin_only')
      return NextResponse.redirect(url)
    }
    if (reqPerm && reqPerm !== 'admin_only' && reqPerm !== 'any_authenticated') {
      if (!hasPermission(user, reqPerm)) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        url.searchParams.set('denied', reqPerm)
        return NextResponse.redirect(url)
      }
    }

    // Forward authenticated user info in headers to avoid double auth round-trips
    if (user?.email) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-email', user.email)
      requestHeaders.set('x-user-id', user.id)

      const nextResponse = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        nextResponse.cookies.set(cookie)
      })
      supabaseResponse = nextResponse
    }
  }

  return supabaseResponse
}
