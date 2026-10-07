import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ActionItem,
  CreateActionItemInput,
  CreateMeetingInput,
  Meeting,
  MeetingListQuery,
  MeetingListResult,
  MeetingSummary,
  Participant,
  UpdateActionItemInput,
  UpdateMeetingInput,
} from './meetings.types.js';

const DEFAULT_ORGANIZER_ID = 'demo-user';

@Injectable()
export class MeetingsService {
  private readonly meetings = new Map<string, Meeting>();
  private readonly actionItems = new Map<string, ActionItem>();
}
