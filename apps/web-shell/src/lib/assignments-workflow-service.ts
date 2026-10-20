import type {
  AssignmentResponse,
  SearchAssignmentsQuery,
  SearchAssignmentsResponse,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ApplicationResponse,
  CreateApplicationInput,
  UpdateApplicationStatusInput,
  AcceptApplicationInput,
  AssignmentStatus,
  ApplicationStatus,
} from '@creatorconnect/contracts';

const API_BASE_URL =
  typeof window !== 'undefined'
    ? ''
    : process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class AssignmentsWorkflowService {
  constructor(private baseUrl: string = API_BASE_URL) {}

  private getAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // ==============================================================================
  // Assignment Discovery & Search (G01, G02)
  // ==============================================================================

  async searchAssignments(
    query: SearchAssignmentsQuery = {},
    token?: string,
  ): Promise<SearchAssignmentsResponse> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.budgetMin !== undefined) params.set('budgetMin', String(query.budgetMin));
    if (query.budgetMax !== undefined) params.set('budgetMax', String(query.budgetMax));
    if (query.isRemote !== undefined) params.set('isRemote', String(query.isRemote));
    if (query.location) params.set('location', query.location);
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.limit !== undefined) params.set('limit', String(query.limit));

    const qs = params.toString();
    const url = `${this.baseUrl}/api/v1/discovery/assignments${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to search assignments.');
    }

    return await res.json();
  }

  // ==============================================================================
  // Assignment CRUD & Lifecycle (G03, G04, G05, G06, G07)
  // ==============================================================================

  async getAssignment(id: string, token?: string): Promise<AssignmentResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Assignment ${id} not found.`);
    }

    return await res.json();
  }

  async getBrandAssignments(token?: string): Promise<AssignmentResponse[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/mine`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch brand assignments.');
    }

    return await res.json();
  }

  async createAssignment(
    input: CreateAssignmentInput,
    token?: string,
  ): Promise<AssignmentResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create assignment brief.');
    }

    return await res.json();
  }

  async updateAssignment(
    id: string,
    input: UpdateAssignmentInput,
    token?: string,
  ): Promise<AssignmentResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update assignment brief.');
    }

    return await res.json();
  }

  async publishAssignment(
    id: string,
    version: number,
    token?: string,
  ): Promise<AssignmentResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/${id}/publish`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify({ version }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to publish assignment brief.');
    }

    return await res.json();
  }

  async closeAssignment(id: string, version: number, token?: string): Promise<AssignmentResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/${id}/close`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify({ version }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to close assignment.');
    }

    return await res.json();
  }

  async deleteAssignment(id: string, token?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete assignment.');
    }

    return { success: true };
  }

  // ==============================================================================
  // Applications & Proposals (G08, G09)
  // ==============================================================================

  async submitProposal(
    assignmentId: string,
    input: CreateApplicationInput,
    token?: string,
  ): Promise<ApplicationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/${assignmentId}/apply`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit proposal.');
    }

    return await res.json();
  }

  async getAssignmentApplications(
    assignmentId: string,
    token?: string,
  ): Promise<ApplicationResponse[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/assignments/${assignmentId}/applications`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch proposals for this assignment.');
    }

    return await res.json();
  }

  async getMyApplications(token?: string): Promise<ApplicationResponse[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/applications/mine`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch submitted proposals.');
    }

    return await res.json();
  }

  async updateApplicationStatus(
    applicationId: string,
    input: UpdateApplicationStatusInput,
    token?: string,
  ): Promise<ApplicationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/applications/${applicationId}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update proposal status.');
    }

    return await res.json();
  }

  async acceptApplication(
    applicationId: string,
    input: AcceptApplicationInput,
    token?: string,
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/applications/${applicationId}/accept`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to accept proposal and initialize project engagement.');
    }

    return await res.json();
  }
}

// ==============================================================================
// Design System & Presentation Helpers
// ==============================================================================

export function formatMinorUnitsToCurrency(amountPaise: number, currency: string = 'INR'): string {
  const units = amountPaise / 100;
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(units);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(units);
}

export function getAssignmentStatusBadgeVariant(status: AssignmentStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'PUBLISHED':
      return {
        label: 'Active & Open',
        bg: 'bg-[#B6E09B]/20',
        text: 'text-[#2D6A2E]',
        border: 'border-[#B6E09B]',
      };
    case 'DRAFT':
      return {
        label: 'Draft',
        bg: 'bg-[#F2ECE1]',
        text: 'text-[#6F675E]',
        border: 'border-[#E7E0D5]',
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Engagement',
        bg: 'bg-[#FFD64A]/25',
        text: 'text-[#875A00]',
        border: 'border-[#FFD64A]',
      };
    case 'COMPLETED':
      return {
        label: 'Completed',
        bg: 'bg-[#C9B6F7]/20',
        text: 'text-[#4F3690]',
        border: 'border-[#C9B6F7]',
      };
    case 'CLOSED':
      return {
        label: 'Closed',
        bg: 'bg-zinc-100',
        text: 'text-zinc-600',
        border: 'border-zinc-300',
      };
    default:
      return {
        label: status,
        bg: 'bg-[#F2ECE1]',
        text: 'text-[#14110F]',
        border: 'border-[#E7E0D5]',
      };
  }
}

export function getApplicationStatusBadgeVariant(status: ApplicationStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'ACCEPTED':
      return {
        label: 'Hired & Active',
        bg: 'bg-[#B6E09B]/20',
        text: 'text-[#2D6A2E]',
        border: 'border-[#B6E09B]',
      };
    case 'SHORTLISTED':
      return {
        label: 'Shortlisted',
        bg: 'bg-[#C9B6F7]/25',
        text: 'text-[#4F3690]',
        border: 'border-[#C9B6F7]',
      };
    case 'SUBMITTED':
      return {
        label: 'Under Review',
        bg: 'bg-[#FFD64A]/25',
        text: 'text-[#875A00]',
        border: 'border-[#FFD64A]',
      };
    case 'REJECTED':
      return {
        label: 'Declined',
        bg: 'bg-[#FFB6C8]/25',
        text: 'text-[#A02842]',
        border: 'border-[#FFB6C8]',
      };
    case 'WITHDRAWN':
      return {
        label: 'Withdrawn',
        bg: 'bg-zinc-100',
        text: 'text-zinc-500',
        border: 'border-zinc-300',
      };
    default:
      return {
        label: status,
        bg: 'bg-[#F2ECE1]',
        text: 'text-[#14110F]',
        border: 'border-[#E7E0D5]',
      };
  }
}

export const assignmentsWorkflowService = new AssignmentsWorkflowService();
