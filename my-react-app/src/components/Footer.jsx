import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer container">
      <div>© 2026 StemLab</div>
      <div className="footer-links">
        <Link to="/labs" className="footer-link">
          Labs
        </Link>
        <Link to="/dashboard" className="footer-link">
          Dashboard
        </Link>
        <a href="#" className="footer-link">
          Terms
        </a>
        <a href="#" className="footer-link">
          Contact
        </a>
      </div>
    </footer>
  )
}
