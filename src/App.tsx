import { RouterProvider } from 'react-router-dom'

import { SyncManager } from './app/SyncManager'
import { router } from './app/router'

function App() {
  return (
    <>
      <SyncManager />
      <RouterProvider router={router} />
    </>
  )
}

export default App
