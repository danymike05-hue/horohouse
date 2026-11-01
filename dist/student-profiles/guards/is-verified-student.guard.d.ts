import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Model } from 'mongoose';
import { StudentProfileDocument } from '../schemas/student-profile.schema';
export declare class IsVerifiedStudentGuard implements CanActivate {
    private studentProfileModel;
    constructor(studentProfileModel: Model<StudentProfileDocument>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
