import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { register as registerUser } from "../services/api";
import { useRouter } from "next/router";
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { useState } from "react";
const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});
type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit: handleFormSubmit, formState:{errors,isSubmitting} } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      setError('');
      await registerUser(data.username, data.email, data.password);
      router.push("/login"); // redirect to login after success
    } catch(err: any){ 
      if (err.response?.status === 409) {
        // Handle conflict error specifically
        const conflictData = err.response?.data;
        if (conflictData?.conflictField) {
          setError(`${conflictData.error}. ${conflictData.details}`);
        } else {
          setError(err.response?.data?.error || "User already exists");
        }
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || "Registration failed");
      }
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Create an Account</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <div className="font-medium">{error}</div>
            {error.includes('already exists') && (
              <div className="mt-2 text-sm">
                💡 Try using a different username/email, or{' '}
                <a href="/login" className="text-blue-600 hover:underline font-medium">
                  sign in to your existing account
                </a>
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm">Username</label>
            <Input {...register('username')} />
            <p className="text-xs text-rose-600">{errors.username?.message as string}</p>
          </div>
          <div>
            <label className="text-sm">Email</label>
            <Input type="email" {...register('email')} />
            <p className="text-xs text-rose-600">{errors.email?.message as string}</p>
          </div>
          <div>
            <label className="text-sm">Password</label>
            <Input type="password" {...register('password')} />
            <p className="text-xs text-rose-600">{errors.password?.message as string}</p>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
        <p className="text-sm text-center mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </Layout>
  );
}
