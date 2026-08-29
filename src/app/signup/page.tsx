"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, {
    error: null,
    info: null,
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-semibold tracking-tight">
        Relay
      </Link>
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Create your organization</CardTitle>
          <CardDescription>This creates a new organization and signs you in as its admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org_name">Organization name</Label>
              <Input id="org_name" type="text" name="org_name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin_name">Your name</Label>
              <Input id="admin_name" type="text" name="admin_name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="designation">Designation (optional)</Label>
              <Input id="designation" type="text" name="designation" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state.info && <p className="text-sm text-muted-foreground">{state.info}</p>}
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Creating…" : "Create organization"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
