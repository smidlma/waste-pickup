import { promises as fs } from 'fs';
import path from 'path';
import WasteLookup from '@/components/WasteLookup';

export default async function Home() {
  const filePath = path.join(process.cwd(), 'public', 'waste.json');
  const fileContents = await fs.readFile(filePath, 'utf8');
  const wasteData = JSON.parse(fileContents);
  
  // The structure is now: { "rozpis_svozu_odpadu": { ... } }
  // We pass the inner object to the component

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 font-sans">
        <div className="max-w-4xl mx-auto text-center mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                Harmonogram Svozu Odpadu
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
               {wasteData.rozpis_svozu_odpadu?.platnost ? `Platnost: ${wasteData.rozpis_svozu_odpadu.platnost}` : 'Vratimov a okolí'}
            </p>
        </div>
        
        <WasteLookup data={wasteData.rozpis_svozu_odpadu} />
    </main>
  );
}
