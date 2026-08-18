'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdventureDetailRedirect() {
  const params = useParams()
  const router = useRouter()
  useEffect(() => { router.replace(`/dashboard/explore-campaigns/${params.id}`) }, [])
  return null
}
