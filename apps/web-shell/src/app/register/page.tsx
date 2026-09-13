'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@creatorconnect/ui';
import { Input } from '@creatorconnect/ui';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@creatorconnect/ui';
import { useAuth } from '../../providers/auth-provider';
import { UserPlus, AlertCircle, Sparkles, Briefcase, Building2, Mic } from 'lucide-react';

const ROLES = [
  {
    id: 'CREATOR',
    title: 'Creator',
    description: 'Video creators, streamers, and influencers sharing content',
    icon: Sparkles,
  },
  {
    id: 'PROFESSIONAL',
    title: 'Professional',
    description: 'Video editors, thumbnail designers, managers, and strategists',
    icon: Briefcase,
  },
  {
    id: 'BRAND',
    title: 'Brand / Sponsor',
    description: 'Companies looking to partner and sponsor leading creators',
    icon: Building2,
  },
  {
    id: 'PODCASTER',
    title: 'Podcaster',
    description: 'Audio & video show hosts, producers, and interviewers',
    icon: Mic,
  },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('CREATOR');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signUp(email, password, selectedRole);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push('/creator');
    }
  };

  return (
    <div className="container relative min-h-[calc(100vh-14rem)] flex items-center justify-center py-12">
      <div className="w-full max-w-xl">
        <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl shadow-primary/5">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold font-heading">Join CreatorConnect</CardTitle>
            <CardDescription className="text-muted-foreground">
              Create your account to connect, collaborate, and scale your reach
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Persona Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium leading-none">Select your primary role</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROLES.map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRole(role.id)}
                        className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border/60 hover:border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon
                            className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                          />
                          <span
                            className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}
                          >
                            {role.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {role.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="email">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                  className="bg-background/50"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
