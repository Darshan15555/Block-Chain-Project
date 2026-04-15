export default function ExplainPanel({ title, subtitle, steps = [], tone = 'accent' }) {
  return (
    <div className={`explain-panel tone-${tone}`}>
      <div className="explain-title">{title}</div>
      {subtitle && <div className="explain-subtitle">{subtitle}</div>}
      <div className="explain-steps">
        {steps.map((step, index) => (
          <div key={`${title}-${index}`} className="explain-step">
            <div className="explain-step-index">{index + 1}</div>
            <div className="explain-step-text">{step}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
