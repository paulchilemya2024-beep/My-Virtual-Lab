import { Link } from 'react-router-dom'

const subjects = [
  { name: 'Chemistry', emoji: '🧪', labs: 18 },
  { name: 'Physics', emoji: '⚡', labs: 12 },
  { name: 'Biology', emoji: '🧬', labs: 14 },
]

const features = [
  {
    title: 'Virtual/Hands-on experiments',
    description:
      'Simulated lab activities let students explore reactions, circuits, and biology without physical equipment.',
  },
  {
    title: 'AI-guided learning',
    description:
      'The tutor provides real-time prompts, feedback, and explanations as learners progress through each activity.',
  },
]

export default function HomePage() {
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Virtual STEM Laboratory</span>
          <h1 className="hero-headline">
            Real science.<br />
            <em>Zero equipment.</em>
          </h1>
          <p className="hero-subtitle">
            Science Experiments that give you experience as 
            closest to the actual thing as possible you know
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">
              Start your first experiment
            </Link>
            <Link to="/labs" className="btn btn-outline btn-lg">
              Browse labs
            </Link>
          </div>
          <div className="hero-stats">
            <div>
              <strong>50+</strong>
              <p>Experiments</p>
            </div>
            <div>
              <strong>12</strong>
              <p>Countries</p>
            </div>
            <div>
              <strong>$0</strong>
              <p>Cost to use</p>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-beaker-wrap">
            <div className="hero-beaker-bg" />
            <div className="floating-tag tag-ph">
              <span>pH</span>
              <strong>6.8</strong>
            </div>
            <div className="floating-tag tag-xp">
              <span>+50 XP</span>
            </div>
            <div className="floating-tag tag-ai">
              <span className="dot-live" />
              AI tutor active
            </div>
            <div className="beaker-mock" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Explore subjects</h2>
            <p>Choose a learning path and launch a lab instantly.</p>
          </div>
        </div>
        <div className="subjects-grid">
          {subjects.map((subject) => (
            <Link key={subject.name} to="/labs" className="subject-card">
              <div className="subject-icon">{subject.emoji}</div>
              <h3>{subject.name}</h3>
              <p className="subject-count">{subject.labs} labs available</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section how-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>Learn by doing with safe digital experiments.</h2>
          </div>
        </div>
        <div className="how-steps">
          <div className="how-step">
            <span className="how-step-num">1</span>
            <h4>Choose a lab</h4>
            <p>Select a science experiment and follow the instructions step-by-step.</p>
          </div>
          <div className="how-step">
            <span className="how-step-num">2</span>
            <h4>Run the simulation</h4>
            <p>Adjust controls, add reagents, and observe live feedback from the system.</p>
          </div>
          <div className="how-step">
            <span className="how-step-num">3</span>
            <h4>Review results</h4>
            <p>Collect scores, insights, and explanations to deepen understanding.</p>
          </div>
        </div>
      </section>

      <section className="section features-grid">
        {features.map((feature) => (
          <div key={feature.title} className="feature-card">
            <div className="feature-icon">⚙️</div>
            <div>
              <h4>{feature.title}</h4>
              <p>{feature.description}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="section cta-banner">
        <div>
          <h2>Ready to start your first experiment?</h2>
          <p>Bring your science classroom online with guided labs and instant feedback.</p>
        </div>
        <Link to="/register" className="btn btn-primary btn-lg">
          Create free account →
        </Link>
      </section>
    </div>
  )
}
