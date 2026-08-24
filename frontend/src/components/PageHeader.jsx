export const PageHeader = ({ title, subtitle, action, testId }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6 rise" data-testid={testId}>
    <div>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);
