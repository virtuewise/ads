import { motion } from 'framer-motion';
import HomePage from './page';

function App() {
  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <HomePage />
      </motion.div>
    </div>
  );
}

export default App;
