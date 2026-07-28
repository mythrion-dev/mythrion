import { Module } from '@nestjs/common'
import { CommunityAdventureController } from './community-adventure.controller.js'
import { CommunityTemplateController } from './community-template.controller.js'
import { AdventureModule } from '../adventure/adventure.module.js'
import { TemplateModule } from '../template/template.module.js'

@Module({
  imports: [AdventureModule, TemplateModule],
  controllers: [CommunityAdventureController, CommunityTemplateController],
})
export class CommunityModule {}
