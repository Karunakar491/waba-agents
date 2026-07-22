import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface LoginInput { email: string; password: string }
interface RegisterInput { companyName: string; email: string; password: string }

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: LoginInput) =>
      api.post('/auth/login', data).then((r) => r.data),
    onSuccess: (res) => {
      const d = res.data
      setUser({ id: d.userId, email: d.email, name: d.email, accountId: d.accountId })
      navigate('/dashboard')
    },
  })
}

export function useRegister() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: RegisterInput) =>
      api.post('/auth/register', data).then((r) => r.data),
    onSuccess: (res) => {
      const d = res.data
      setUser({ id: d.userId, email: d.email, name: d.email, accountId: d.accountId })
      navigate('/dashboard')
    },
  })
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => api.post('/auth/logout').then((r) => r.data),
    onSettled: () => {
      clearAuth()
      navigate('/login')
    },
  })
}

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser)

  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.user),
    retry: false,
    staleTime: 5 * 60 * 1000,
    select: (d) => {
      const user = { id: d.userId, email: d.email, name: d.email, accountId: d.accountId }
      setUser(user)
      return user
    },
  })
}
