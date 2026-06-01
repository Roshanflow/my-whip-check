export function motStatus(latestMot) {
  if (!latestMot) return { label: 'No MOT', color: 'none' }
  if (latestMot.result === 'fail') return { label: 'Failed', color: 'fail' }

  const today = new Date()
  const expiry = new Date(latestMot.expiry_date)
  const daysLeft = Math.floor((expiry - today) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { label: 'Expired', color: 'expired' }
  if (daysLeft <= 30) return { label: `Expires in ${daysLeft}d`, color: 'soon' }
  return { label: `Valid until ${expiry.toLocaleDateString('en-GB')}`, color: 'valid' }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
