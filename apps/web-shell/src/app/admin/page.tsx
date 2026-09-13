import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@creatorconnect/ui';
import { ShieldCheck, AlertCircle, CheckCircle2, UserCheck, Lock } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="container max-w-7xl px-4 sm:px-8 py-10 space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="warning" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Operations Cockpit</span>
            </Badge>
            <span className="text-xs text-muted-foreground">Domain: /admin</span>
          </div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">
            Compliance, KYC & Escrow Governance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify identities, review flagged dispute arbitrations, and monitor system-wide escrow
            invariants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-success text-success gap-1.5 py-1 px-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Escrow Invariants Verified</span>
          </Badge>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pending KYC Verifications</span>
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">7 Pending</div>
          <p className="text-xs text-muted-foreground mt-1">4 Creators, 3 Production Freelancers</p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Disputes</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">1 Case</div>
          <p className="text-xs text-muted-foreground mt-1">
            Milestone revision threshold disagreement
          </p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Escrow Vault Invariant</span>
            <Lock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">100.00% Matched</div>
          <p className="text-xs text-muted-foreground mt-1">
            Zero balance mismatch across all ledger accounts
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="kyc" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kyc">KYC Queue (7)</TabsTrigger>
          <TabsTrigger value="disputes">Dispute Arbitration</TabsTrigger>
          <TabsTrigger value="system">System Security Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Government ID & Bank Account Review</CardTitle>
                <CardDescription>
                  Submitted by: Rahul Sharma (Video Editor) • PAN & Bank Verified
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">
                  Reject
                </Button>
                <Button size="sm">Approve KYC</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2 text-xs text-muted-foreground">
              Verification documents cryptographically verified against Razorpay Route payout
              beneficiary API.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Dispute evidence locker with deliverable version comparisons and chat history.
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Realtime audit trail of RBAC role evaluations and authentication events.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
