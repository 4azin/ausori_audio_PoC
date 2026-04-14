"use client";

import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function LoginForm() {
  const router = useRouter();

  return (
    <div className="w-full max-w-md p-8 bg-panel rounded-2xl border border-border shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
        <p className="text-gray-400">Sign in to your account</p>
      </div>

      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); router.push('/projects'); }}>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-300" htmlFor="email">Email</label>
          <Input id="email" type="email" placeholder="name@company.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-gray-300" htmlFor="password">Password</label>
          <Input id="password" type="password" placeholder="••••••••" />
        </div>
        
        <Button className="w-full mt-2" type="submit">Sign In</Button>
      </form>

      <div className="mt-8 flex items-center justify-center">
        <span className="h-px bg-border flex-1"></span>
        <span className="px-4 text-xs text-gray-500 uppercase font-medium">Or continue with</span>
        <span className="h-px bg-border flex-1"></span>
      </div>

      <div className="mt-6">
        <Button variant="outline" className="w-full flex items-center justify-center gap-2 py-5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </Button>
      </div>
    </div>
  );
}
