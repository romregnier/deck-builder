import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DecksPage } from './pages/DecksPage'
import { NewDeckPage } from './pages/NewDeckPage'
import { DeckEditorPage } from './pages/DeckEditorPage'
import { DeckPresentPage } from './pages/DeckPresentPage'
import { DeckAnalyticsPage } from './pages/DeckAnalyticsPage'
import { TemplatesPage } from './pages/TemplatesPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/decks" replace />} />
        <Route path="/decks" element={<DecksPage />} />
        <Route path="/decks/new" element={<NewDeckPage />} />
        <Route path="/decks/:id/edit" element={<DeckEditorPage />} />
        <Route path="/decks/:id/present" element={<DeckPresentPage />} />
        <Route path="/decks/:id/analytics" element={<DeckAnalyticsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="*" element={<Navigate to="/decks" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
