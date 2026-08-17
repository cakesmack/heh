import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ScannerRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/organizers/scanner');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-900 text-white">
      <p className="font-bold text-sm">Opening Scanner Hub...</p>
    </div>
  );
}
