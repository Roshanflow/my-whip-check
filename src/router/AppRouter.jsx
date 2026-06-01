import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage'
import ResetPasswordPage from '../features/auth/ResetPasswordPage'
import VehiclesPage from '../features/vehicles/VehiclesPage'
import AddVehiclePage from '../features/vehicles/AddVehiclePage'
import EditVehiclePage from '../features/vehicles/EditVehiclePage'
import VehicleDetailPage from '../features/vehicles/VehicleDetailPage'
import AddMotPage from '../features/mot/AddMotPage'
import EditMotPage from '../features/mot/EditMotPage'
import AddServicePage from '../features/service/AddServicePage'
import EditServicePage from '../features/service/EditServicePage'

export default function AppRouter() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes inside AppLayout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<VehiclesPage />} />
          <Route path="/vehicles/new" element={<AddVehiclePage />} />
          <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
          <Route path="/vehicles/:id/edit" element={<EditVehiclePage />} />
          <Route path="/vehicles/:id/mot/new" element={<AddMotPage />} />
          <Route path="/vehicles/:id/mot/:motId/edit" element={<EditMotPage />} />
          <Route path="/vehicles/:id/service/new" element={<AddServicePage />} />
          <Route path="/vehicles/:id/service/:serviceId/edit" element={<EditServicePage />} />
        </Route>
      </Route>
    </Routes>
  )
}
