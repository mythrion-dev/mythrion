'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function TemplatePreviewRedirect() {
  const params = useParams()
  const router = useRouter()
  useEffect(() => { router.replace(`/dashboard/public-templates/${params.id}/preview`) }, [])
  return null
}
