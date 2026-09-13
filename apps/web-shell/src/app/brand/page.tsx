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
import { Building2, Plus, DollarSign, Target, ShieldCheck, ArrowUpRight } from 'lucide-react';

export default function BrandPage() {
  return (
    <div className="container max-w-7xl px-4 sm:px-8 py-10 space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              <span>Brand Persona</span>
            </Badge>
            <span className="text-xs text-muted-foreground">Domain: /brand</span>
          </div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">
            Enterprise Campaign Orchestrator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage creator sponsorships, fund milestone escrows, and inspect verified campaign
            deliverables.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Launch Campaign</span>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Campaigns</span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">2 Active</div>
          <p className="text-xs text-muted-foreground mt-1">
            Festive Tech Launch & Audio Gear Review
          </p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Escrow Balance (Razorpay)</span>
            <DollarSign className="h-4 w-4 text-success" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">₹5,00,000</div>
          <p className="text-xs text-muted-foreground mt-1">
            Protected by two-party cryptographic release
          </p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Contracted Creators</span>
            <ShieldCheck className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">8 Creators</div>
          <p className="text-xs text-muted-foreground mt-1">Cumulative reach: 4.2M audience</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="campaigns">Active Campaigns</TabsTrigger>
          <TabsTrigger value="shortlist">Talent Shortlist</TabsTrigger>
          <TabsTrigger value="escrow">Escrow Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Diwali Q4 Consumer Electronics Push</CardTitle>
                <CardDescription>
                  Escrow Allocated: ₹3,50,000 • 5 Creator Milestones
                </CardDescription>
              </div>
              <Badge variant="default">In Production</Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                3 deliverables awaiting brand sign-off before escrow release
              </span>
              <Button size="sm" variant="outline" className="gap-1">
                <span>Manage Campaign</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shortlist">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            AI-assisted creator matching shortlist and audience engagement analytics.
          </Card>
        </TabsContent>

        <TabsContent value="escrow">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Detailed ledger of Razorpay transactions and automated milestone releases.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
