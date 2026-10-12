const features = [
  {
    title: "Today's Campaign",
    description: 'Generate and review daily advertising concepts',
  },
  { title: 'Concepts', description: 'Browse and manage creative concepts' },
  { title: 'Campaigns', description: 'View and manage campaign families' },
  { title: 'Assets', description: 'Browse the asset library' },
  { title: 'QA', description: 'Review quality assurance results' },
  { title: 'Analytics', description: 'View campaign performance' },
];

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-brand">
        PrintSync Creative Studio
      </h1>
      <p className="mt-3 text-neutral-700">
        Welcome to the PrintSync Creative Operating System.
      </p>
      <p className="mt-1 max-w-3xl text-neutral-500">
        This studio will provide a visual interface for campaign management,
        concept review, creative scoring, and production oversight.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} {...feature} />
        ))}
      </div>
    </main>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="text-base font-medium text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm text-neutral-500">{description}</p>
    </div>
  );
}
