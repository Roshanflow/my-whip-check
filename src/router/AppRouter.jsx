import { Routes, Route } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import HomePage from '../pages/HomePage'

export default function AppRouter() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </AppLayout>
  )
}
