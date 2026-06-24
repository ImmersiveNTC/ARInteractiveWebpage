import { ReactNode } from "react";

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, className = "mb-12" }: PageHeaderProps) {
  return (
    <header className={className}>
      <h1 className="text-3xl text-white/95">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-white/50">{subtitle}</p>
      )}
    </header>
  );
}
