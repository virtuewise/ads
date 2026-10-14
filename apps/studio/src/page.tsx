import { motion } from 'framer-motion';

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

function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <motion.h1
        className="text-3xl font-semibold tracking-tight text-brand"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Virtue Studio
      </motion.h1>
      <motion.p
        className="mt-3 text-neutral-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Welcome to Virtue Studio — a multi-brand creative production platform.
      </motion.p>
      <motion.p
        className="mt-1 max-w-3xl text-neutral-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        This studio provides a visual interface for campaign management, concept review, creative
        scoring, and production oversight.
      </motion.p>
      <motion.div
        className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {features.map((feature, index) => (
          <Card key={feature.title} {...feature} index={index} />
        ))}
      </motion.div>
    </main>
  );
}

function Card({
  title,
  description,
  index,
}: {
  title: string;
  description: string;
  index: number;
}) {
  return (
    <motion.div
      className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
    >
      <h3 className="text-base font-medium text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm text-neutral-500">{description}</p>
    </motion.div>
  );
}

export default HomePage;
