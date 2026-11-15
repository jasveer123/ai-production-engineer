import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { IncidentActivityService } from './application/incident-activity.service';
import { IncidentCollabService } from './application/incident-collab.service';
import { IncidentReader } from './application/incident-reader';
import { IncidentResponseService } from './application/incident-response.service';
import { IncidentResponseController } from './incident-response.controller';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [IncidentsController, IncidentResponseController],
  providers: [
    IncidentsService,
    IncidentReader,
    IncidentResponseService,
    IncidentCollabService,
    IncidentActivityService,
  ],
  exports: [IncidentReader],
})
export class IncidentsModule {}
