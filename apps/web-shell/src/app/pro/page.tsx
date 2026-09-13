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
import { Briefcase, ArrowUpRight, DollarSign, Award, Star } from 'lucide-react';

export default function ProPage() {
  return (
    <div className="container max-w-7xl px-4 sm:px-8 py-10 space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              <span>Production Professional</span>
            </Badge>
            <span className="text-xs text-muted-foreground">Domain: /pro</span>
          </div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">
            Freelancer Console & Deliverables
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Showcase your verified portfolio, manage incoming briefs, and track escrow payouts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <span>Edit Rate Card</span>
          </Button>
          <Button className="gap-2 shadow-sm">
            <span>Browse Open Briefs</span>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Completed Projects</span>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">28 Gigs</div>
          <p className="text-xs text-muted-foreground mt-1">100% On-Time Delivery Rate</p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Escrow Receivable</span>
            <DollarSign className="h-4 w-4 text-success" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">₹72,000</div>
          <p className="text-xs text-muted-foreground mt-1">
            Ready for withdrawal on client review
          </p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Client Rating</span>
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">4.96 / 5.0</div>
          <p className="text-xs text-muted-foreground mt-1">From 24 verified reviews</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="applications">My Applications</TabsTrigger>
          <TabsTrigger value="deliverables">Upload Deliverables</TabsTrigger>
          <TabsTrigger value="portfolio">Showreel & Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Travel Channel — 10-Part Reel Series Editing</CardTitle>
                <CardDescription>Submitted 2 days ago • Fixed Milestone: ₹30,000</CardDescription>
              </div>
              <Badge variant="warning">Shortlisted by Creator</Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Proposal: 3-day turnaround with Davinci Resolve color pass
              </span>
              <Button size="sm" variant="outline" className="gap-1">
                <span>View Brief</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliverables">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Deliverable upload pipeline with presigned Cloudflare R2 upload sessions.
          </Card>
        </TabsContent>

        <TabsContent value="portfolio">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Showreel video player and equipment kit listing.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
