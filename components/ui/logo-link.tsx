import Link from 'next/link';
import logo from '../../app/logo_full.png';

interface LogoLinkProps {
  href?: string;
  text?: string;
  className?: string;
}

export function LogoLink({
  href = 'https://luxury-select.co.kr/',
  text = 'AI Concierge',
  className = '',
}: LogoLinkProps) {
  return (
    <Link
      target="_blank"
      href={href}
      className={`flex flex-row gap-3 items-center aspect-[302/108] h-7 mr-1 bg-contain bg-no-repeat dark:invert ${className}`}
      style={{
        backgroundImage: `url(${logo.src})`,
      }}
    >
      <span className="sr-only">Tourvis Select {text}</span>
    </Link>
  );
}
