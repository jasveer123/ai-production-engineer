import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  type Invitation,
  type InvitationWithLink,
  type InviteMemberInput,
  type Member,
  type UpdateMemberRoleInput,
} from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MembersService } from './members.service';
import { MinRole } from './min-role.decorator';
import { WorkspaceAccessGuard } from './workspace-access.guard';

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('members')
  list(@Actor() actor: ActorContext): Promise<Member[]> {
    return this.members.list(actor);
  }

  @Patch('members/:memberId')
  @MinRole('admin')
  updateRole(
    @Actor() actor: ActorContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) body: UpdateMemberRoleInput,
  ): Promise<Member> {
    return this.members.updateRole(actor, memberId, body.role);
  }

  @Delete('members/:memberId')
  @MinRole('admin')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.members.remove(actor, memberId);
  }

  @Get('invitations')
  @MinRole('admin')
  listInvitations(@Actor() actor: ActorContext): Promise<Invitation[]> {
    return this.members.listInvitations(actor);
  }

  @Post('invitations')
  @MinRole('admin')
  invite(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ): Promise<InvitationWithLink> {
    return this.members.invite(actor, body.email, body.role);
  }

  @Delete('invitations/:invitationId')
  @MinRole('admin')
  @HttpCode(204)
  revokeInvitation(
    @Actor() actor: ActorContext,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.members.revokeInvitation(actor, invitationId);
  }
}
