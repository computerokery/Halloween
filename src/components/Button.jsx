import { ArrowRight, ArrowUpRight } from './Icons.jsx';
import './Button.css';

const ICONS = { right: ArrowRight, 'up-right': ArrowUpRight };

/**
 * variant: 'primary' | 'secondary' | 'tertiary' | 'outline'
 *   outline — pill CTA used in the header ("Buy tickets").
 * icon: 'right' | 'up-right' | null
 */
export default function Button({
  as: Tag = 'a',
  variant = 'primary',
  icon = 'right',
  className = '',
  children,
  ...props
}) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <Tag className={`btn btn--${variant} ${className}`.trim()} {...props}>
      <span className="btn__label">{children}</span>
      {Icon && (
        <span className="btn__icon">
          <Icon size={variant === 'outline' ? 16 : 15} />
        </span>
      )}
    </Tag>
  );
}
