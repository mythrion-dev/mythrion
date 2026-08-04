'use client'

import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shared/PageHeader'
import { TwoFactorSettings } from '@/components/dashboard'

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div>
      <PageHeader title={t('common:settings')} />
      <div className="mt-8 space-y-6 max-w-2xl">
        <TwoFactorSettings />
      </div>
    </div>
  )
}
