import { useEffect } from 'react'
import Whiteboard from '../board/Whiteboard.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// The lecture board: a full-screen writing surface for instructors explaining a
// concept, and a scratch space for students working a problem through by hand.
// Boards are stored per account in this browser, so two people sharing a laptop
// keep separate work.
export default function BoardPage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Board • StemLab'
  }, [])

  return (
    <div className="board-page">
      <Whiteboard
        storageKey={`stemlab.board.main.${user?.id || 'guest'}`}
        fileName="stemlab-board"
      />
    </div>
  )
}