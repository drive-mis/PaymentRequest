export function Logo({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  const text = dark ? "text-white" : "text-df-text";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="7" cy="6" rx="3" ry="3" fill="url(#df-logo-grad)" />
        <path d="M11 21L18 5" stroke="url(#df-logo-grad)" strokeWidth="3" strokeLinecap="round" />
        <defs>
          <linearGradient id="df-logo-grad" x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5655E5" />
            <stop offset="0.55" stopColor="#4B2E9E" />
            <stop offset="1" stopColor="#2FA9C9" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`leading-none ${text}`}>
        <span className="font-bold tracking-tight text-[15px]">DRIVE</span>
        <span className="font-light tracking-[0.2em] text-[15px] ml-1">FINANCE</span>
      </span>
    </div>
  );
}
