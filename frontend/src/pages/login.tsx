import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
type Form = z.infer<typeof schema>;

export default function LoginPage(){
  const { login } = useAuth();
  const [error, setError] = useState<string>('');
  const { register, handleSubmit, formState:{errors,isSubmitting} } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data:Form) => {
    try {
      setError('');
      await login(data.email, data.password);
    } catch(err: any){ 
      setError(err.message || 'Login failed');
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm">Email</label>
            <Input {...register('email')} />
            <p className="text-xs text-rose-600">{errors.email?.message as string}</p>
          </div>
          <div>
            <label className="text-sm">Password</label>
            <Input type="password" {...register('password')} />
            <p className="text-xs text-rose-600">{errors.password?.message as string}</p>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? '...' : 'Sign in'}</Button>
        </form>
        
        <p className="text-sm text-center mt-6">
          Don't have an account?{" "}
          <a href="/register" className="text-blue-600 hover:underline">
            Create one
          </a>
        </p>
      </div>
    </Layout>
  );
}
