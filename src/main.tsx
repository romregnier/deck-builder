import * as Sentry from '@sentry/react'
Sentry.init({
  dsn: 'https://25d93bc4b45cf5e78f96770da68e0498@o4511004596633600.ingest.de.sentry.io/4511004637659216',
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 0,
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
