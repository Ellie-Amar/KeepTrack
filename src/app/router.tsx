import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AppLayout } from './AppLayout'
import { RequireSession, RootRedirect } from './guards'
import { AuthPage } from '../pages/AuthPage'
import { TaskDetailPage } from '../pages/TaskDetailPage'
import { TasksPage } from '../pages/TasksPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: (
      <RequireSession>
        <AppLayout />
      </RequireSession>
    ),
    children: [
      {
        path: '/tasks',
        element: <TasksPage />,
      },
      {
        path: '/tasks/:taskId',
        element: <TaskDetailPage />,
      },
      {
        path: '*',
        element: <Navigate to="/tasks" replace />,
      },
    ],
  },
])
