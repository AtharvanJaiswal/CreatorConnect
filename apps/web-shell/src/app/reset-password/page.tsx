'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
import { createClient } from '../../lib/supabase';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password reset request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container relative min-h-[calc(100vh-14rem)] flex items-center justify-center py-12">
      <div className="w-full max-w-md">
        <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl shadow-primary/5">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold font-heading">Reset Password</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your email address to receive password recovery instructions
            </CardDescription>
          </CardHeader>

          {success ? (
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Check your inbox</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We have sent a secure password reset link to{' '}
                    <strong className="text-foreground">{email}</strong> if an account exists.
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <Link href="/login" className="w-full">
                  <Button variant="outline" className="w-full">
                    Return to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="email">
                    Account Email
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
              </CardContent>

              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending instructions...' : 'Send Reset Link'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{' '}
                  <Link href="/login" className="text-primary hover:underline font-medium">
                    Back to sign in
                  </Link>
                </p>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
