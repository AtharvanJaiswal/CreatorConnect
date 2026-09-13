'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@creatorconnect/ui';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@creatorconnect/ui';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="container relative min-h-[calc(100vh-14rem)] flex items-center justify-center py-12">
      <div className="w-full max-w-md text-center">
        <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl shadow-destructive/5">
          <CardHeader className="space-y-2">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold font-heading">Access Denied</CardTitle>
            <CardDescription className="text-muted-foreground">
              You do not have the required permissions or your account status does not permit
              accessing this resource.
            </CardDescription>
          </CardHeader>

          <CardContent className="text-sm text-muted-foreground pb-2">
            <p>
              If you believe this is an error, please contact your workspace administrator or
              support team.
            </p>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Link href="/" className="w-full sm:w-1/2">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-1/2">
              <Button className="w-full flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Sign In</span>
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
