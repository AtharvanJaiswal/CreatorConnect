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
import { Video, Plus, Clock, Users, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function CreatorPage() {
  return (
    <div className="container max-w-7xl px-4 sm:px-8 py-10 space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="default" className="gap-1.5">
              <Video className="h-3.5 w-3.5" />
              <span>Creator Persona</span>
            </Badge>
            <span className="text-xs text-muted-foreground">Domain: /creator</span>
          </div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">
            Creator Studio & Briefs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orchestrate production projects, hire verified freelancers, and approve milestone
            deliverables.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Post New Brief</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Briefs</span>
            <Video className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">3 Open</div>
          <p className="text-xs text-muted-foreground mt-1">14 freelancer applications pending</p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Escrow Protected Funds</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">₹1,45,000</div>
          <p className="text-xs text-muted-foreground mt-1">
            Held securely until milestone approval
          </p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Production Crew</span>
            <Users className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">5 Talent</div>
          <p className="text-xs text-muted-foreground mt-1">
            2 Video Editors, 1 Colorist, 2 Sound Designers
          </p>
        </Card>
      </div>

      {/* Tabs View */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Projects</TabsTrigger>
          <TabsTrigger value="applications">Applications (14)</TabsTrigger>
          <TabsTrigger value="crew">My Crew Roster</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>YouTube Documentary — Episode 4 Post-Production</CardTitle>
                <CardDescription>
                  Deliverable deadline: 5 days remaining • 4K Master Cut
                </CardDescription>
              </div>
              <Badge variant="success">Milestone 2: Rough Cut Approved</Badge>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Due Sep 18, 2026
                </span>
                <span>•</span>
                <span>Budget: ₹45,000</span>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <span>View Timeline</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Candidate screening pipeline populated via @creatorconnect/contracts DTOs.
          </Card>
        </TabsContent>

        <TabsContent value="crew">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Saved roster and direct contract invitations.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
