// ---------------------------------------------------------------------------
// Domain types — Meeting Notes MVP
// ---------------------------------------------------------------------------

export type ActionItemStatus = 'open' | 'in_progress' | 'done';
export type MeetingStatus = 'draft' | 'published';

export interface Participant {
  id: string;
  name: string;
  email?: string;
  role: 'host' | 'note_taker' | 'attendee';
}

export interface ActionItem {
  id: string;
  meetingId: string;
  description: string;
  ownerId?: string;
  ownerName?: string;
  dueDate?: string;        // ISO date string YYYY-MM-DD
  status: ActionItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  organizerId: string;
  title: string;
  agenda: string;
  notes: string;
  scheduledAt: string;     // ISO datetime
  participants: Participant[];
  actionItems: ActionItem[];
  status: MeetingStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Summary returned in the list view (no notes body or action items)
export interface MeetingSummary {
  id: string;
  title: string;
  scheduledAt: string;
  participantCount: number;
  actionItemCount: number;
  openActionItemCount: number;
  status: MeetingStatus;
  version: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateMeetingInput {
  title?: string;
  agenda?: string;
  scheduledAt?: string;
  participants?: Omit<Participant, 'id'>[];
}

export interface UpdateMeetingInput {
  title?: string;
  agenda?: string;
  notes?: string;
  scheduledAt?: string;
  participants?: Omit<Participant, 'id'>[];
  status?: MeetingStatus;
  version?: number;
}

export interface CreateActionItemInput {
  description: string;
  ownerName?: string;
  ownerId?: string;
  dueDate?: string;
}

export interface UpdateActionItemInput {
  description?: string;
  ownerName?: string;
  ownerId?: string;
  dueDate?: string;
  status?: ActionItemStatus;
}

export interface MeetingListQuery {
  limit?: number;
  offset?: number;
  search?: string;
  status?: MeetingStatus;
}

export interface MeetingListResult {
  data: MeetingSummary[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}
