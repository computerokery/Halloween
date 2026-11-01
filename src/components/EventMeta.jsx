import './EventMeta.css';

/** Letter-spaced uppercase label ("ONE NIGHT. NO RULES."). */
export function SectionLabel({ as: Tag = 'p', className = '', children }) {
  return <Tag className={`section-label ${className}`.trim()}>{children}</Tag>;
}

/**
 * variant: 'line' — full-width hairline
 *          'accent' — short orange rule under a label
 */
export function Divider({ variant = 'line', className = '' }) {
  return <hr className={`divider divider--${variant} ${className}`.trim()} aria-hidden="true" />;
}

export function DateIndicator({ date, dateTime, time }) {
  return (
    <p className="date-indicator">
      <time className="date-indicator__date" dateTime={dateTime}>
        {date}
      </time>
      <span className="date-indicator__time">{time}</span>
    </p>
  );
}

/** Small label + value pair ("Dress code — Anything but ordinary"). */
export function InfoItem({ label, children }) {
  return (
    <div className="info-item">
      <dt className="info-item__label">{label}</dt>
      <dd className="info-item__value">{children}</dd>
    </div>
  );
}
