import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  createApiTokenSchema,
  type ApiTokenView,
  type ApiTokenWithSecret,
  type CreateApiTokenInput,
} from '@ape/api-contracts';
import { unauthorized } from '../../core/common/errors';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { ApiTokensService } from './application/api-tokens.service';

const PAT_SESSION = 'pat:';

@Controller('auth/api-tokens')
export class ApiTokensController {
  constructor(private readonly tokens: ApiTokensService) {}

  @Get()
  list(@Req() req: Request): Promise<ApiTokenView[]> {
    return this.tokens.list(req.auth!.userId);
  }

  @Post()
  create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createApiTokenSchema)) body: CreateApiTokenInput,
  ): Promise<ApiTokenWithSecret> {
    if (req.auth!.sessionId.startsWith(PAT_SESSION)) throw unauthorized();
    return this.tokens.create(req.auth!.userId, body);
  }

  @Delete(':tokenId')
  @HttpCode(204)
  revoke(@Req() req: Request, @Param('tokenId', ParseUUIDPipe) id: string): Promise<void> {
    return this.tokens.revoke(req.auth!.userId, id);
  }
}
