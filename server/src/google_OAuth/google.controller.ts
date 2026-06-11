import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { GoogleService } from './google.service.js'

@Controller('auth')
export class GoogleController {
    constructor (private readonly googleService: GoogleService){}

    @Get('google')
    @UseGuards(AuthGuard('google'))
    googleAuth(){

    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAutCallBack(@Req()req: any){

        const user = req.user

        return this.googleService.signTokens(user.id, user.email)
    }
}