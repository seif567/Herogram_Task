import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <Layout><div>Loading...</div></Layout>;

  if (isAuthenticated) {
    return <Layout><div>Redirecting to dashboard...</div></Layout>;
  }

  return (
    <Layout>
      <main className="text-center py-20">
        <h1 className="text-4xl font-bold mb-4">Herogram Task - Feature + Redis</h1>
        <p className="text-lg text-gray-600 mb-8">A modern full-stack application with authentication and Redis integration</p>
        <div className="space-x-4">
          <Button onClick={() => router.push('/login')} className="bg-blue-600 hover:bg-blue-700">
            Login
          </Button>
        </div>
      </main>
    </Layout>
  );
}
